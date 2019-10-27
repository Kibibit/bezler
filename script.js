const { ipcRenderer } = require('electron');

console.log(ipcRenderer.sendSync('synchronous-message', 'ping')); // prints "pong"

ipcRenderer.on('asynchronous-reply', (event, arg) => {
  console.log(arg) // prints "pong"
});

ipcRenderer.on('theme-changed', (event, arg) => changeTheme(arg));

ipcRenderer.send('asynchronous-message', 'ping');

document.addEventListener("DOMContentLoaded", function() {
  console.log('Your document is ready!');

  /* event listener */
  document.getElementById('enable').addEventListener('change', enable);
});

enable();

function enable() {
  ipcRenderer.send('enable-bezels', {
    'MAME': true
  });
}

function changeTheme(shouldChangeToDark) {
  console.log('starting!', shouldChangeToDark);
  const body = document.getElementsByTagName('body')[0];

  if (shouldChangeToDark) {
    body.classList.remove('light');
    return;
  }
  
  if (!body.classList.contains('light')) {
    body.classList.add('light');
  }
}
