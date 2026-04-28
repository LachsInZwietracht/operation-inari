CREATE OR REPLACE FUNCTION get_practice_dashboard_summary()
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
      date_trunc('month', CURRENT_DATE)::date AS current_month_start,
      (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date AS previous_month_start,
      (CURRENT_DATE + INTERVAL '7 days')::date AS seven_days_from_now,
      (CURRENT_DATE + INTERVAL '14 days')::date AS fourteen_days_from_now
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
  counseling_base AS (
    SELECT c.*
    FROM counseling_sessions c
    JOIN current_user_context ctx ON c.user_id = ctx.user_id
  ),
  patient_counts AS (
    SELECT
      COUNT(*)::integer AS active_patients,
      COUNT(*) FILTER (
        WHERE created_at >= (SELECT current_month_start FROM date_context)
      )::integer AS current_new_patients,
      COUNT(*) FILTER (
        WHERE created_at >= (SELECT previous_month_start FROM date_context)
          AND created_at < (SELECT current_month_start FROM date_context)
      )::integer AS previous_new_patients
    FROM patient_base
  ),
  appointment_counts AS (
    SELECT
      COUNT(*) FILTER (
        WHERE date >= (SELECT today FROM date_context)
      )::integer AS upcoming_total,
      COUNT(*) FILTER (
        WHERE date >= (SELECT today FROM date_context)
          AND date <= (SELECT seven_days_from_now FROM date_context)
      )::integer AS next_7_days
    FROM appointment_base
  ),
  invoice_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE status <> 'bezahlt')::integer AS open_count,
      COALESCE(SUM(amount) FILTER (WHERE status <> 'bezahlt'), 0)::numeric AS open_amount
    FROM invoice_base
  ),
  counseling_counts AS (
    SELECT
      COUNT(*) FILTER (
        WHERE session_date >= (SELECT current_month_start FROM date_context)
      )::integer AS current_month_sessions,
      COUNT(*) FILTER (
        WHERE session_date >= (SELECT previous_month_start FROM date_context)
          AND session_date < (SELECT current_month_start FROM date_context)
      )::integer AS previous_month_sessions
    FROM counseling_base
  ),
  revenue_data AS (
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
    ) AS items
    FROM (
      SELECT
        date_trunc('month', due_date)::date AS month_bucket,
        COALESCE(SUM(amount) FILTER (WHERE status = 'bezahlt'), 0)::numeric AS paid_amount,
        COALESCE(SUM(amount) FILTER (WHERE status <> 'bezahlt'), 0)::numeric AS open_amount
      FROM invoice_base
      WHERE due_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '3 months')::date
      GROUP BY date_trunc('month', due_date)::date
    ) buckets
  ),
  next_appointments AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'date', date,
          'startTime', to_char(start_time, 'HH24:MI'),
          'endTime', to_char(end_time, 'HH24:MI'),
          'type', type,
          'name', appointment_name
        )
        ORDER BY date, start_time
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT
        a.id,
        a.date,
        a.start_time,
        a.end_time,
        a.type,
        COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), a.title) AS appointment_name
      FROM appointment_base a
      LEFT JOIN patient_base p ON p.id::text = a.patient_id
      WHERE a.date >= (SELECT today FROM date_context)
      ORDER BY a.date, a.start_time
      LIMIT 5
    ) upcoming
  ),
  upcoming_birthdays AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'patientId', id,
          'firstName', first_name,
          'lastName', last_name,
          'dueDate', next_birthday
        )
        ORDER BY next_birthday, last_name, first_name
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT
        id,
        first_name,
        last_name,
        CASE
          WHEN birthday_this_year < (SELECT today FROM date_context)
            THEN (
              birthday_this_year + INTERVAL '1 year'
            )::date
          ELSE birthday_this_year
        END AS next_birthday
      FROM (
        SELECT
          p.id,
          p.first_name,
          p.last_name,
          make_date(
            EXTRACT(YEAR FROM CURRENT_DATE)::integer,
            EXTRACT(MONTH FROM p.date_of_birth)::integer,
            LEAST(
              EXTRACT(DAY FROM p.date_of_birth)::integer,
              EXTRACT(
                DAY FROM (
                  date_trunc(
                    'month',
                    make_date(
                      EXTRACT(YEAR FROM CURRENT_DATE)::integer,
                      EXTRACT(MONTH FROM p.date_of_birth)::integer,
                      1
                    )
                  ) + INTERVAL '1 month - 1 day'
                )
              )::integer
            )
          ) AS birthday_this_year
        FROM patient_base p
      ) birthdays
    ) next_birthdays
    WHERE next_birthday <= (SELECT fourteen_days_from_now FROM date_context)
  ),
  activity_feed AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', activity_id,
          'type', activity_type,
          'title', title,
          'timestamp', activity_timestamp
        )
        ORDER BY activity_timestamp DESC
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT *
      FROM (
        SELECT
          'patient_' || p.id::text AS activity_id,
          'patient' AS activity_type,
          TRIM(CONCAT(p.first_name, ' ', p.last_name)) || ' angelegt' AS title,
          p.created_at AS activity_timestamp
        FROM patient_base p
        WHERE p.created_at IS NOT NULL

        UNION ALL

        SELECT
          'appt_' || a.id::text AS activity_id,
          'appointment' AS activity_type,
          'Termin: ' || COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), a.title) AS title,
          COALESCE(a.created_at, (a.date + a.start_time)::timestamp with time zone) AS activity_timestamp
        FROM appointment_base a
        LEFT JOIN patient_base p ON p.id::text = a.patient_id

        UNION ALL

        SELECT
          'session_' || c.id::text AS activity_id,
          'counseling' AS activity_type,
          'Beratung: ' || COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), 'Patient') AS title,
          COALESCE(c.created_at, c.session_date::timestamp with time zone) AS activity_timestamp
        FROM counseling_base c
        LEFT JOIN patient_base p ON p.id = c.patient_id

        UNION ALL

        SELECT
          'inv_' || i.id::text AS activity_id,
          'invoice' AS activity_type,
          'Rechnung: ' || i.service AS title,
          COALESCE(i.created_at, i.due_date::timestamp with time zone) AS activity_timestamp
        FROM invoice_base i
      ) activities
      ORDER BY activity_timestamp DESC
      LIMIT 8
    ) recent
  )
  SELECT jsonb_build_object(
    'activePatients', COALESCE((SELECT active_patients FROM patient_counts), 0),
    'currentNewPatients', COALESCE((SELECT current_new_patients FROM patient_counts), 0),
    'previousNewPatients', COALESCE((SELECT previous_new_patients FROM patient_counts), 0),
    'upcomingAppointmentsTotal', COALESCE((SELECT upcoming_total FROM appointment_counts), 0),
    'next7DaysAppointments', COALESCE((SELECT next_7_days FROM appointment_counts), 0),
    'openInvoicesCount', COALESCE((SELECT open_count FROM invoice_counts), 0),
    'openInvoicesAmount', COALESCE((SELECT open_amount FROM invoice_counts), 0),
    'currentMonthSessions', COALESCE((SELECT current_month_sessions FROM counseling_counts), 0),
    'previousMonthSessions', COALESCE((SELECT previous_month_sessions FROM counseling_counts), 0),
    'activityFeed', (SELECT items FROM activity_feed),
    'revenueData', (SELECT items FROM revenue_data),
    'nextAppointments', (SELECT items FROM next_appointments),
    'upcomingBirthdays', (SELECT items FROM upcoming_birthdays),
    'isEmptyWorkspace',
      COALESCE((SELECT active_patients FROM patient_counts), 0) = 0
      AND (SELECT COUNT(*) FROM appointment_base) = 0
      AND (SELECT COUNT(*) FROM invoice_base) = 0
      AND (SELECT COUNT(*) FROM counseling_base) = 0
  );
$$;

GRANT EXECUTE ON FUNCTION get_practice_dashboard_summary() TO authenticated;
