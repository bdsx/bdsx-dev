## Code Contribution Guide
`bdsx` accepts any codes for extending. but it needs to keep little rules for maintaining it.

### 1. Keep the legacy
Old scripts are broken If names are changed or removed. Please keep the old names as deprecated if you want to change the name.

### 2. Reduce using offsets
Offsets are easily changed after updates.  
Use getter if it's possible.  
Or, make sure the size of the previous fields and remove offsets if it's possible.  
Or, Please write where offsets come from.  

### 3. Following Minecraft official name
About Minecraft APIs, To make it easy to guess for everyone, use the known official name of Minecraft if it's possible.

### 4. Choice shorter and simpler for external APIs
use EntityCreate instead of EntityCreated
use `get name()` instead of `getName()`
destruct all destructable instances at `process.nextTick()` for external APIs

## Tips
* `./bdsx` directory is using ESLint for the code formatting. it would be better to use ESLint Extension for VSCode.
