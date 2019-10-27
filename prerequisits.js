const platform = require('is-os');

if (platform.isMac) {
  console.log(`brew install libgcrypt`);
  return;
}

