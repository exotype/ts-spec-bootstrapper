
describe(`aFunction`, () => {
  describe(`when (c1)`, () => {
    xit(`should be implemented`, () => {
      // ...
    });
  });

  describe(`when (!(c1))`, () => {
    describe(`when (c2)`, () => {
      xit(`should be implemented`, () => {
        // ...
      });
    });

    describe(`when (!(c2))`, () => {
      describe(`when (c3)`, () => {
        xit(`should be implemented`, () => {
          // ...
        });
      });

      describe(`when (!(c3))`, () => {
        xit(`should be implemented`, () => {
          // ...
        });
      });
    });
  });
});
