### Splitting data

Counting lines: `wc -l ./normanAccounts.csv`

Splitting into 15 pieces:

```bash
split -l 2844 -a 1 ./orig_normanAccounts.csv normanAccounts
```

### Unusual cases

#### No data

Has an element with class `nodataformview` instead of normal elements.

Example (2011 and earlier): http://www.clevelandcountyassessor.us/Data.aspx?Account=R0162307

#### Account type MOBILE HOME

Land value is missing for some years (assumed to be 0). Has all other data. (Clicking the "Land" tab causes "Server Error in '/' Application."...so don't do that.)

Example: http://www.clevelandcountyassessor.us/Data.aspx?Account=M0094747

#### Account type EXEMPT REAL

Various fields missing from data. These properties are excluded from analysis.

Example: http://www.clevelandcountyassessor.us/Data.aspx?Account=R0101470
