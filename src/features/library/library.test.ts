/**
 * Zero-dependency unit tests for official NASA library guides data integrity and structure.
 * Run with Node 24 native type stripping:
 *   node --experimental-strip-types src/features/library/library.test.ts
 */

import officialNasaGuides from "../../data/officialNasaGuides.json" with { type: "json" };
import type { LibraryGuide } from "../../types/library";

let assertions = 0;

function check(condition: boolean, message: string): void {
  assertions += 1;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function equal<T>(actual: T, expected: T, message: string): void {
  check(
    actual === expected,
    `${message} (expected ${String(expected)}, received ${String(actual)})`,
  );
}

function testLibraryGuides() {
  const guides = officialNasaGuides as LibraryGuide[];

  // 1. Data Integrity Tests
  check(guides.length >= 6, "Expected at least 6 official NASA guides");

  for (const guide of guides) {
    check(Boolean(guide.id), "Guide must have an id");
    check(Boolean(guide.nasaDocumentId), `Guide ${guide.id} must have a nasaDocumentId`);
    check(Boolean(guide.title), `Guide ${guide.id} must have a title`);
    check(Boolean(guide.category), `Guide ${guide.id} must have a category`);
    check(guide.durationMinutes > 0, `Guide ${guide.id} must have duration > 0`);
    check(guide.instructions.length >= 3, `Guide ${guide.id} must have at least 3 instruction steps`);
    check(guide.safetyNotices.length >= 1, `Guide ${guide.id} must have at least 1 safety notice`);
    check(guide.chapters.length >= 2, `Guide ${guide.id} must have at least 2 chapter markers`);
    check(guide.mediaUrl.startsWith("http"), `Guide ${guide.id} must have a valid web media URL`);
    check(Boolean(guide.verifiedBy), `Guide ${guide.id} must specify who verified it`);

    // Verify each chapter has time and seconds
    for (const ch of guide.chapters) {
      check(ch.time.includes(":"), `Chapter ${ch.title} time must be MM:SS formatted`);
      check(typeof ch.seconds === "number", `Chapter ${ch.title} seconds must be a number`);
    }
  }

  // 2. Category Coverage
  const categories = new Set(guides.map((g) => g.category));
  check(categories.has("exercise"), "Must cover exercise category");
  check(categories.has("sleep"), "Must cover sleep category");
  check(categories.has("medical"), "Must cover medical category");
  check(categories.has("nutrition"), "Must cover nutrition category");
  check(categories.has("adaptation"), "Must cover adaptation category");

  // 3. Search and Filter Simulation
  const exerciseGuides = guides.filter((g) => g.category === "exercise");
  check(exerciseGuides.length >= 2, "Expected at least 2 exercise guides (ARED & T2)");

  const aredGuide = guides.find((g) => g.title.includes("ARED"));
  check(Boolean(aredGuide), "Expected ARED guide to exist");
  equal(aredGuide?.nasaDocumentId, "NASA-STD-3001-V2 Section 6.4", "ARED doc id");

  const smsGuide = guides.find((g) => g.category === "adaptation");
  check(Boolean(smsGuide), "Expected adaptation SMS guide to exist");
  check(Boolean(smsGuide?.relatedSymptomCodes?.includes("NAUSEA")), "SMS guide should relate to NAUSEA");

  console.log(`PASS · ${assertions} assertions · official NASA library guides data integrity and structure`);
}

testLibraryGuides();
