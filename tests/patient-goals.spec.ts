import { expect, test } from "@playwright/test";

import { parsePatientGoals, patientGoalSummary } from "@/lib/intake/patient-goals";

/**
 * The intake stores the goal as labelled lines, and every screen that shows it
 * puts its own "Ziel" heading in front. Splitting the lines is what keeps the
 * word from arriving twice — see lib/intake/apply-submission.ts for the writer.
 */

test.describe("parsePatientGoals", () => {
  test("splits the labelled lines the intake writes", () => {
    const parsed = parsePatientGoals(
      "Ziel: Abnehmen\nZeithorizont: 3 Monate\nMotivation: Wieder Rad fahren",
    );

    expect(parsed.goal).toBe("Abnehmen");
    expect(parsed.timeframe).toBe("3 Monate");
    expect(parsed.motivation).toBe("Wieder Rad fahren");
    expect(parsed.notes).toBeUndefined();
  });

  test("reads the plural label the intake uses for several goals", () => {
    expect(parsePatientGoals("Ziele: Abnehmen, Mehr Energie im Alltag").goal).toBe(
      "Abnehmen, Mehr Energie im Alltag",
    );
  });

  test("treats free prose as the goal itself", () => {
    // A counselor typing into the patient form is the normal case, not an error.
    const parsed = parsePatientGoals("Gewicht halten und Blutdruck senken");

    expect(parsed.goal).toBe("Gewicht halten und Blutdruck senken");
    expect(parsed.notes).toBeUndefined();
  });

  test("keeps unlabelled lines beside a labelled goal as notes", () => {
    const parsed = parsePatientGoals("Ziel: Abnehmen\nPatientin bringt Laborwerte mit");

    expect(parsed.goal).toBe("Abnehmen");
    expect(parsed.notes).toBe("Patientin bringt Laborwerte mit");
  });

  test("drops a label with nothing behind it", () => {
    const parsed = parsePatientGoals("Ziel: Abnehmen\nMotivation:");

    expect(parsed.goal).toBe("Abnehmen");
    expect(parsed.motivation).toBeUndefined();
  });

  test("returns nothing for an empty record", () => {
    expect(parsePatientGoals(undefined)).toEqual({});
    expect(parsePatientGoals("   ")).toEqual({});
  });
});

test.describe("patientGoalSummary", () => {
  test("prefers the parsed goal over the intake reason", () => {
    expect(patientGoalSummary("Ziel: Abnehmen", "Mehr Energie im Alltag")).toBe("Abnehmen");
  });

  test("falls back to the intake reason when no goal was written", () => {
    expect(patientGoalSummary(null, "Mehr Energie im Alltag")).toBe(
      "Mehr Energie im Alltag",
    );
  });

  test("is undefined when neither exists", () => {
    expect(patientGoalSummary(null, null)).toBeUndefined();
  });
});
