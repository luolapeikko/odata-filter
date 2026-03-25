# @luolapeikko/odata-filter

## Builds a data filter based on $filter query values.

Handles most OData comparison operators (`eq` | `ne` | `gt` | `ge` | `lt` | `le`), logical operators (`and` | `or` | `not`), array lambda operators (`any` | `all`), and functions (`contains` | `startswith` | `endswith` | `tolower` | `toupper` | `trim` | `length` | `concat` | `indexof` | `substring`).
Automatic ISO DateTime string / Date handling, and uses `toString()` for custom objects in comparisons.

## Usage example

```typescript
import { buildODataFilter } from "@luolapeikko/odata-filter";

const handleRequest = (req, res, next) => {
  const dataArray: DataType[] = await getSomeData();
  const queryFilter = req.query.$filter;
  if (typeof queryFilter === "string") {
    const filterCallback = buildODataFilter<DataType>(queryFilter);
    res.json(dataArray.filter(filterCallback));
  }
};
```
