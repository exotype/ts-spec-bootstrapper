function anEmptyFunction(): void {
  // ...
}

const theSecondFunction = (): void => {
  if (!window) {
    // ...
  } else if (!document) {
    // ...
  }
}