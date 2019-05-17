process.setMaxListeners(40);

/**
 * Add a handler for various types of process exits.
 * Errors from this handler will be captured and logged.
 */
export function addExitHandler(exitHandler: () => any) {
  // https://stackoverflow.com/questions/14031763/doing-a-cleanup-action-just-before-node-js-exits

  function safeExitHandler() {
    try {
      const result = exitHandler();
      if (result && typeof result === 'object' && (result as Promise<any>).then) {
        (result as Promise<any>).catch(err => {
          console.log('Caught error from promise in exit handler: ' + err);
        });
      }
    } catch (ex) {
      console.log('Caught error in exit handler: ' + ex);
    }
  }

  // do something when app is closing
  process.on('exit', safeExitHandler);

  // catches ctrl+c event
  process.on('SIGINT', safeExitHandler);

  // catches "kill pid" (for example: nodemon restart)
  process.on('SIGUSR1', safeExitHandler);
  process.on('SIGUSR2', safeExitHandler);

  // catches uncaught exceptions
  process.on('uncaughtException', safeExitHandler);
}
