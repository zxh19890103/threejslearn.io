import * as THREE from "three";

const rowRexp = /(.+)\n/g;
const valueTrimRexp = /^[\s"']+|[\s"']+$/g;

export const loadStatellites = async () => {
  const res = await fetch(__relativeURL__("./satellites.txt"));
  const txt = await res.text();
  // "35,781"

  let columns: string[] = null;
  const rows = [];

  let match: RegExpExecArray = null;
  let columnsSize = 0;

  console.time("parsing");
  while ((match = rowRexp.exec(txt))) {
    const line = match[1].split(/\t/g);
    if (columns) {
      const values: any[] = line.slice(0, columnsSize);

      for (let i = 0; i < columnsSize; i++) {
        const dt = names[2 * i + 1] as DT;
        values[i] = parseValue(values[i], dt);
      }
      rows.push(values);
    } else {
      columns = line.filter(Boolean);
      columnsSize = columns.length;
    }
  }
  console.timeEnd("parsing");

  return {
    columns,
    columnsSize,
    rows,
  } as LoadStatellitesReturns;
};

type CellValue = string | number | Date;

export type LoadStatellitesReturns = {
  /**
```
0: '"Name of Satellite, Alternate Names"',
1: "Current Official Name of Satellite",
2: "Country/Org of UN Registry",
3: "Country of Operator/Owner",
4: "Operator/Owner",
5: "Users",
6: "Purpose",
7: "Detailed Purpose",
8: "Class of Orbit",
9: "Type of Orbit",
10: "Longitude of GEO (degrees)",
11: "Perigee (km)",
12: "Apogee (km)",
13: "Eccentricity",
14: "Inclination (degrees)",
15: "Period (minutes)",
16: "Launch Mass (kg.)",
17: " Dry Mass (kg.) ",
18: "Power (watts)",
19: "Date of Launch",
20: "Expected Lifetime (yrs.)",
21: "Contractor",
22: "Country of Contractor",
23: "Launch Site",
24: "Launch Vehicle",
25: "COSPAR Number",
26: "NORAD Number",
27: "Comments",
28: "Source Used for Orbital Data",
29: "Source",
30: "Source",
31: "Source",
32: "Source",
33: "Source",
34: "Source",
35: "Source",
```
 */
  columns: string[];
  columnsSize: number;
  /**
```
0: '"Name of Satellite, Alternate Names"',
1: "Current Official Name of Satellite",
2: "Country/Org of UN Registry",
3: "Country of Operator/Owner",
4: "Operator/Owner",
5: "Users",
6: "Purpose",
7: "Detailed Purpose",
8: "Class of Orbit",
9: "Type of Orbit",
10: "Longitude of GEO (degrees)",
11: "Perigee (km)",
12: "Apogee (km)",
13: "Eccentricity",
14: "Inclination (degrees)",
15: "Period (minutes)",
16: "Launch Mass (kg.)",
17: " Dry Mass (kg.) ",
18: "Power (watts)",
19: "Date of Launch",
20: "Expected Lifetime (yrs.)",
21: "Contractor",
22: "Country of Contractor",
23: "Launch Site",
24: "Launch Vehicle",
25: "COSPAR Number",
26: "NORAD Number",
27: "Comments",
28: "Source Used for Orbital Data",
29: "Source",
30: "Source",
31: "Source",
32: "Source",
33: "Source",
34: "Source",
35: "Source",
```
 */
  rows: CellValue[];
};

function parseValue(val: string, dt: DT) {
  switch (dt) {
    case "Str": {
      return val.replace(valueTrimRexp, "");
    }
    case "Str_UnkownIfEmpty": {
      let val_ = val.replace(valueTrimRexp, "");
      return val_ ? val_ : "Unknown";
    }
    case "Dat": {
      const val_ = Date.parse(val);
      return val_;
    }
    case "Num": {
      let val_: string | number = val.replace(valueTrimRexp, "");
      val_ = parseFloat(val_.replace(/,/g, ""));
      return val_;
    }
    default: {
      throw new Error(`no DT ${dt}`);
    }
  }
}

type DT = "Str" | "Str_UnkownIfEmpty" | "Num" | "Dat";

const names = [
  '"Name of Satellite, Alternate Names"',
  "Str",
  "Current Official Name of Satellite",
  "Str",
  "Country/Org of UN Registry",
  "Str",
  "Country of Operator/Owner",
  "Str",
  "Operator/Owner",
  "Str",
  "Users",
  "Str",
  "Purpose",
  "Str",
  "Detailed Purpose",
  "Str",
  "Class of Orbit",
  "Str_UnkownIfEmpty",
  "Type of Orbit",
  "Str_UnkownIfEmpty",
  "Longitude of GEO (degrees)",
  "Num",
  "Perigee (km)",
  "Num",
  "Apogee (km)",
  "Num",
  "Eccentricity",
  "Num",
  "Inclination (degrees)",
  "Num",
  "Period (minutes)",
  "Num",
  "Launch Mass (kg.)",
  "Num",
  " Dry Mass (kg.) ",
  "Num",
  "Power (watts)",
  "Num",
  "Date of Launch",
  "Dat",
  "Expected Lifetime (yrs.)",
  "Num",
  "Contractor",
  "Str",
  "Country of Contractor",
  "Str",
  "Launch Site",
  "Str",
  "Launch Vehicle",
  "Str",
  "COSPAR Number",
  "Str",
  "NORAD Number",
  "Str",
  "Comments",
  "Str",
  "Source Used for Orbital Data",
  "Str",
  "Source",
  "Str",
  "Source",
  "Str",
  "Source",
  "Str",
  "Source",
  "Str",
  "Source",
  "Str",
  "Source",
  "Str",
  "Source",
  "Str",
];
