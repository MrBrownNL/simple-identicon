# Simple identicons

Easily add identicons to your project.

## Install

```
npm install simple-identicons -S
```

## Example

```ts
import { Identicon } from "simple-identicons";
// OR in nodeJS ( commonJS module )
const { Identicon } = require("simple-identicons");

const myIdenticon = new Identicon();

console.log(myIdenticon.generate("seedString"));
```

Enjoy !
