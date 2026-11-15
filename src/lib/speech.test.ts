import { cleanTextForVoice } from "./speech.ts";

let assertions = 0;

function check(condition: boolean, message: string): void {
  assertions += 1;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Test 1: Stripping bold, italics, and headers
const mdHeaderAndBold = "### Clinical Finding\n**Elevated CO2** observed in Node 2.";
const cleaned1 = cleanTextForVoice(mdHeaderAndBold);
check(!cleaned1.includes("###"), "Should strip markdown headers");
check(!cleaned1.includes("**"), "Should strip bold asterisks");
check(cleaned1.includes("Clinical Finding"), "Should retain header text");
check(cleaned1.includes("Elevated CO2"), "Should retain bold text");

// Test 2: Stripping code blocks and inline backticks
const mdCode = "Check sensor value `CO2_VAL`:\n```json\n{\"co2\": 4200}\n```\nReport immediately.";
const cleaned2 = cleanTextForVoice(mdCode);
check(!cleaned2.includes("```"), "Should strip code block markers");
check(!cleaned2.includes("`CO2_VAL`"), "Should strip inline backticks");
check(cleaned2.includes("CO2_VAL"), "Should retain code text content");

// Test 3: Markdown tables
const mdTable = `
| Step | Action | Target |
| :--- | :--- | :--- |
| 1 | Transition CDRA | CDRA-ECLSS |
`;
const cleaned3 = cleanTextForVoice(mdTable);
check(!cleaned3.includes("|"), "Should remove table pipe markers");
check(!cleaned3.includes(":---"), "Should remove table divider lines");
check(cleaned3.includes("Transition CDRA"), "Should keep action content");

// Test 4: Markdown links and bullet points
const mdList = "- Refer to [Flight Rule ECLSS-001](file:///rules/eclss.md) for contingency steps.";
const cleaned4 = cleanTextForVoice(mdList);
check(!cleaned4.includes("[Flight Rule"), "Should strip square bracket link syntax");
check(!cleaned4.includes("file:///"), "Should strip URL links");
check(!cleaned4.startsWith("-"), "Should strip leading bullet hyphen");
check(cleaned4.includes("Flight Rule ECLSS-001"), "Should retain link text");

console.log(`PASS · ${assertions} assertions · speech audio text sanitization`);

