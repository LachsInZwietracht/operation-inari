CREATE OR REPLACE FUNCTION get_practice_statistics_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH current_user_context AS (
    SELECT auth.uid() AS user_id
  ),
  date_context AS (
    SELECT
      CURRENT_DATE AS today,
      date_trunc('week', CURRENT_DATE)::date AS week_start,
      (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::date AS week_end,
      date_trunc('month', CURRENT_DATE)::date AS current_month_start,
      (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date AS previous_month_start,
      date_trunc('year', CURRENT_DATE)::date AS current_year_start
  ),
  range_context AS (
    SELECT 'month' AS range_key, (SELECT current_month_start FROM date_context) AS range_start
    UNION ALL
    SELECT 'quarter', (date_trunc('month', CURRENT_DATE) - INTERVAL '2 months')::date
    UNION ALL
    SELECT 'year', (SELECT current_year_start FROM date_context)
    UNION ALL
    SELECT 'all', DATE '1900-01-01'
  ),
  patient_base AS (
    SELECT p.*
    FROM patients p
    JOIN current_user_context ctx ON p.user_id = ctx.user_id
  ),
  appointment_base AS (
    SELECT a.*
    FROM appointments a
    JOIN current_user_context ctx ON a.user_id = ctx.user_id
  ),
  invoice_base AS (
    SELECT i.*
    FROM invoices i
    JOIN current_user_context ctx ON i.user_id = ctx.user_id
  ),
  kpi_counts AS (
    SELECT
      (SELECT COUNT(*)::integer FROM patient_base) AS active_patients,
      (
        SELECT COUNT(*)::integer
        FROM patient_base
        WHERE created_at >= (SELECT current_month_start FROM date_context)
      ) AS current_new_patients,
      (
        SELECT COUNT(*)::integer
        FROM patient_base
        WHERE created_at >= (SELECT previous_month_start FROM date_context)
          AND created_at < (SELECT current_month_start FROM date_context)
      ) AS previous_new_patients,
      (
        SELECT COUNT(*)::integer
        FROM appointment_base
        WHERE date >= (SELECT current_month_start FROM date_context)
      ) AS current_month_appointments,
      (
        SELECT COUNT(*)::integer
        FROM appointment_base
        WHERE date >= (SELECT previous_month_start FROM date_context)
          AND date < (SELECT current_month_start FROM date_context)
      ) AS previous_month_appointments,
      (
        SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (end_time - start_time)) / 60)), 0)::integer
        FROM appointment_base
        WHERE date >= (SELECT current_month_start FROM date_context)
      ) AS current_avg_duration,
      (
        SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (end_time - start_time)) / 60)), 0)::integer
        FROM appointment_base
        WHERE date >= (SELECT previous_month_start FROM date_context)
          AND date < (SELECT current_month_start FROM date_context)
      ) AS previous_avg_duration,
      (
        SELECT COALESCE(SUM(amount), 0)::numeric
        FROM invoice_base
        WHERE due_date >= (SELECT current_month_start FROM date_context)
      ) AS current_revenue,
      (
        SELECT COALESCE(SUM(amount), 0)::numeric
        FROM invoice_base
        WHERE due_date >= (SELECT previous_month_start FROM date_context)
          AND due_date < (SELECT current_month_start FROM date_context)
      ) AS previous_revenue,
      (
        SELECT COUNT(*)::integer
        FROM appointment_base
        WHERE date >= (SELECT week_start FROM date_context)
          AND date <= (SELECT week_end FROM date_context)
      ) AS appointments_this_week
  ),
  gender_distribution AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'name',
          CASE COALESCE(gender, 'd')
            WHEN 'm' THEN 'Männlich'
            WHEN 'w' THEN 'Weiblich'
            WHEN 'd' THEN 'Divers'
            ELSE gender
          END,
          'value',
          count_value
        )
        ORDER BY count_value DESC
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT COALESCE(gender, 'd') AS gender, COUNT(*)::integer AS count_value
      FROM patient_base
      GROUP BY COALESCE(gender, 'd')
    ) buckets
  ),
  top_indications AS (
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('name', indication, 'count', count_value) ORDER BY count_value DESC),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT indication, COUNT(*)::integer AS count_value
      FROM patient_base
      WHERE indication IS NOT NULL AND btrim(indication) <> ''
      GROUP BY indication
      ORDER BY count_value DESC
      LIMIT 5
    ) buckets
  )
  SELECT jsonb_build_object(
    'activePatients', COALESCE((SELECT active_patients FROM kpi_counts), 0),
    'currentNewPatients', COALESCE((SELECT current_new_patients FROM kpi_counts), 0),
    'previousNewPatients', COALESCE((SELECT previous_new_patients FROM kpi_counts), 0),
    'currentMonthAppointments', COALESCE((SELECT current_month_appointments FROM kpi_counts), 0),
    'previousMonthAppointments', COALESCE((SELECT previous_month_appointments FROM kpi_counts), 0),
    'currentAvgDuration', COALESCE((SELECT current_avg_duration FROM kpi_counts), 0),
    'previousAvgDuration', COALESCE((SELECT previous_avg_duration FROM kpi_counts), 0),
    'currentRevenue', COALESCE((SELECT current_revenue FROM kpi_counts), 0),
    'previousRevenue', COALESCE((SELECT previous_revenue FROM kpi_counts), 0),
    'appointmentsThisWeek', COALESCE((SELECT appointments_this_week FROM kpi_counts), 0),
    'genderDistribution', (SELECT items FROM gender_distribution),
    'topIndications', (SELECT items FROM top_indications),
    'ranges',
      (
        SELECT jsonb_object_agg(
          r.range_key,
          jsonb_build_object(
            'appointmentTimeline',
              (
                SELECT COALESCE(
                  jsonb_agg(
                    jsonb_build_object(
                      'iso', date,
                      'label', to_char(date, 'DD.MM.'),
                      'appointments', appointment_count,
                      'patientSlots', patient_slots
                    )
                    ORDER BY date
                  ),
                  '[]'::jsonb
                )
                FROM (
                  SELECT
                    a.date,
                    COUNT(*)::integer AS appointment_count,
                    COUNT(*) FILTER (WHERE a.patient_id IS NOT NULL)::integer AS patient_slots
                  FROM appointment_base a
                  WHERE a.date >= r.range_start
                  GROUP BY a.date
                ) timeline
              ),
            'typeBreakdown',
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'type',
                    CASE type_key
                      WHEN 'beratung' THEN 'Beratung'
                      WHEN 'kontrolle' THEN 'Follow-up'
                      WHEN 'team' THEN 'Team'
                      WHEN 'webinar' THEN 'Workshop'
                      ELSE type_key
                    END,
                    'termine',
                    total,
                    'patienten',
                    patient_slots
                  )
                  ORDER BY sort_order
                )
                FROM (
                  SELECT
                    type_key,
                    sort_order,
                    COALESCE(counts.total, 0)::integer AS total,
                    COALESCE(counts.patient_slots, 0)::integer AS patient_slots
                  FROM (
                    VALUES
                      ('beratung', 1),
                      ('kontrolle', 2),
                      ('team', 3),
                      ('webinar', 4)
                  ) AS types(type_key, sort_order)
                  LEFT JOIN (
                    SELECT
                      a.type,
                      COUNT(*)::integer AS total,
                      COUNT(*) FILTER (WHERE a.patient_id IS NOT NULL)::integer AS patient_slots
                    FROM appointment_base a
                    WHERE a.date >= r.range_start
                    GROUP BY a.type
                  ) counts ON counts.type = types.type_key
                ) type_rows
              ),
            'monthlyRevenueData',
              (
                SELECT COALESCE(
                  jsonb_agg(
                    jsonb_build_object(
                      'month', to_char(month_bucket, 'MM.YY'),
                      'sortKey', to_char(month_bucket, 'YYYY-MM'),
                      'bezahlt', paid_amount,
                      'offen', open_amount
                    )
                    ORDER BY month_bucket
                  ),
                  '[]'::jsonb
                )
                FROM (
                  SELECT
                    date_trunc('month', due_date)::date AS month_bucket,
                    COALESCE(SUM(amount) FILTER (WHERE status = 'bezahlt'), 0)::numeric AS paid_amount,
                    COALESCE(SUM(amount) FILTER (WHERE status <> 'bezahlt'), 0)::numeric AS open_amount
                  FROM invoice_base
                  WHERE due_date >= r.range_start
                  GROUP BY date_trunc('month', due_date)::date
                ) revenue
              ),
            'newPatientsPerMonth',
              (
                SELECT COALESCE(
                  jsonb_agg(
                    jsonb_build_object(
                      'month', to_char(month_bucket, 'MM.YY'),
                      'sortKey', to_char(month_bucket, 'YYYY-MM'),
                      'count', count_value
                    )
                    ORDER BY month_bucket
                  ),
                  '[]'::jsonb
                )
                FROM (
                  SELECT date_trunc('month', created_at)::date AS month_bucket, COUNT(*)::integer AS count_value
                  FROM patient_base
                  WHERE created_at >= r.range_start
                  GROUP BY date_trunc('month', created_at)::date
                ) new_patients
              ),
            'durationStats',
              (
                SELECT jsonb_build_object(
                  'mean', COALESCE(AVG(duration_minutes), 0),
                  'min', COALESCE(MIN(duration_minutes), 0),
                  'max', COALESCE(MAX(duration_minutes), 0),
                  'std', COALESCE(stddev_samp(duration_minutes), 0)
                )
                FROM (
                  SELECT GREATEST(15, EXTRACT(EPOCH FROM (end_time - start_time)) / 60) AS duration_minutes
                  FROM appointment_base
                  WHERE date >= r.range_start
                ) durations
              ),
            'invoiceStats',
              (
                SELECT jsonb_build_object(
                  'mean', COALESCE(AVG(amount), 0),
                  'min', COALESCE(MIN(amount), 0),
                  'max', COALESCE(MAX(amount), 0),
                  'std', COALESCE(stddev_samp(amount), 0)
                )
                FROM invoice_base
                WHERE due_date >= r.range_start
              ),
            'uniquePatients',
              (
                SELECT COUNT(DISTINCT patient_id)::integer
                FROM appointment_base
                WHERE date >= r.range_start AND patient_id IS NOT NULL
              ),
            'totalRevenue',
              (
                SELECT COALESCE(SUM(amount), 0)::numeric
                FROM invoice_base
                WHERE due_date >= r.range_start
              ),
            'outstandingRevenue',
              (
                SELECT COALESCE(SUM(amount), 0)::numeric
                FROM invoice_base
                WHERE due_date >= r.range_start AND status <> 'bezahlt'
              ),
            'paymentRate',
              (
                SELECT CASE
                  WHEN COALESCE(SUM(amount), 0) = 0 THEN 0
                  ELSE ROUND(((SUM(amount) - COALESCE(SUM(amount) FILTER (WHERE status <> 'bezahlt'), 0)) / SUM(amount)) * 100)::integer
                END
                FROM invoice_base
                WHERE due_date >= r.range_start
              ),
            'averageTicket',
              (
                SELECT COALESCE(AVG(amount), 0)::numeric
                FROM invoice_base
                WHERE due_date >= r.range_start
              ),
            'recurringShare',
              (
                SELECT CASE
                  WHEN COUNT(*) = 0 THEN 0
                  ELSE ROUND((COUNT(*) FILTER (WHERE recurring IS NOT NULL)::numeric / COUNT(*)) * 100)::integer
                END
                FROM appointment_base
                WHERE date >= r.range_start
              ),
            'overdueInvoices',
              (
                SELECT COALESCE(
                  jsonb_agg(
                    jsonb_build_object(
                      'id', id,
                      'service', service,
                      'dueDate', due_date,
                      'amount', amount
                    )
                    ORDER BY due_date
                  ),
                  '[]'::jsonb
                )
                FROM invoice_base
                WHERE due_date >= r.range_start
                  AND status <> 'bezahlt'
                  AND due_date < (SELECT today FROM date_context)
              )
          )
        )
        FROM range_context r
      )
  );
$$;

GRANT EXECUTE ON FUNCTION get_practice_statistics_summary() TO authenticated;
