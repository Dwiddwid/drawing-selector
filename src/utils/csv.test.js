import { describe, it, expect } from "vitest";
import {
  parseCsv,
  normalizeParticipants,
  participantKey,
  parseParticipantsCsv,
} from "./csv.js";

describe("parseCsv", () => {
  it("parses basic rows into header-keyed objects", () => {
    const { headers, rows } = parseCsv(
      "First Name,Last Name\nAda,Lovelace\nAlan,Turing"
    );
    expect(headers).toEqual(["First Name", "Last Name"]);
    expect(rows).toEqual([
      { "First Name": "Ada", "Last Name": "Lovelace" },
      { "First Name": "Alan", "Last Name": "Turing" },
    ]);
  });

  it("handles quoted fields containing commas", () => {
    const { rows } = parseCsv('First Name,Last Name\nJohn,"Smith, Jr."');
    expect(rows[0]["Last Name"]).toBe("Smith, Jr.");
  });

  it("handles escaped double quotes", () => {
    const { rows } = parseCsv('First Name,Last Name\n"A ""B"" C",Doe');
    expect(rows[0]["First Name"]).toBe('A "B" C');
  });

  it("handles CRLF and CR line endings", () => {
    const crlf = parseCsv("First Name,Last Name\r\nAda,Lovelace\r\n");
    const cr = parseCsv("First Name,Last Name\rAda,Lovelace");
    expect(crlf.rows).toEqual([{ "First Name": "Ada", "Last Name": "Lovelace" }]);
    expect(cr.rows).toEqual([{ "First Name": "Ada", "Last Name": "Lovelace" }]);
  });

  it("trims headers and values and skips blank lines", () => {
    const { headers, rows } = parseCsv(
      "  First Name , Last Name \n\n Ada , Lovelace \n   \n"
    );
    expect(headers).toEqual(["First Name", "Last Name"]);
    expect(rows).toEqual([{ "First Name": "Ada", "Last Name": "Lovelace" }]);
  });

  it("returns empty result for empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
    expect(parseCsv("   \n  ")).toEqual({ headers: [], rows: [] });
  });
});

describe("normalizeParticipants", () => {
  it("matches first/last name headers case-insensitively", () => {
    const { headers, rows } = parseCsv("first name,LASTNAME\nAda,Lovelace");
    const [p] = normalizeParticipants(headers, rows);
    expect(p.firstName).toBe("Ada");
    expect(p.lastName).toBe("Lovelace");
  });

  it("keeps all other columns as ordered extras", () => {
    const { headers, rows } = parseCsv(
      "First Name,Last Name,School Grade,Bus Route\nAda,Lovelace,3,12B"
    );
    const [p] = normalizeParticipants(headers, rows);
    expect(p.extras).toEqual({ "School Grade": "3", "Bus Route": "12B" });
    expect(Object.keys(p.extras)).toEqual(["School Grade", "Bus Route"]);
  });

  it("throws when a required name column is missing", () => {
    const { headers, rows } = parseCsv("Name,Grade\nAda,3");
    expect(() => normalizeParticipants(headers, rows)).toThrow(/First Name/);
  });

  it("skips rows with no name", () => {
    const { headers, rows } = parseCsv(
      "First Name,Last Name\nAda,Lovelace\n,\nAlan,Turing"
    );
    const result = normalizeParticipants(headers, rows);
    expect(result).toHaveLength(2);
  });

  it("assigns a unique id to each participant", () => {
    const list = parseParticipantsCsv(
      "First Name,Last Name\nAda,Lovelace\nAlan,Turing"
    );
    expect(list[0].id).toBeTruthy();
    expect(list[0].id).not.toBe(list[1].id);
  });
});

describe("participantKey", () => {
  it("is stable for identical content regardless of case", () => {
    const a = { firstName: "Ada", lastName: "Lovelace", extras: { Grade: "3" } };
    const b = { firstName: "ada", lastName: "LOVELACE", extras: { Grade: "3" } };
    expect(participantKey(a)).toBe(participantKey(b));
  });

  it("differs when an extra field differs", () => {
    const a = { firstName: "Ada", lastName: "Lovelace", extras: { Bus: "1" } };
    const b = { firstName: "Ada", lastName: "Lovelace", extras: { Bus: "2" } };
    expect(participantKey(a)).not.toBe(participantKey(b));
  });
});
