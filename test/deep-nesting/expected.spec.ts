
describe(`deeplyNested`, () => {
  describe(`when (c1)`, () => {
    describe(`when (c2)`, () => {
      xit(`should be implemented`, () => {
        // ...
      });
    });

    describe(`when (!(c2))`, () => {
      xit(`should be implemented`, () => {
        // ...
      });
    });
  });

  describe(`when (!(c1))`, () => {
    describe(`when (c3)`, () => {
      describe(`when (c4)`, () => {
        xit(`should be implemented`, () => {
          // ...
        });
      });

      describe(`when (!(c4))`, () => {
        xit(`should be implemented`, () => {
          // ...
        });
      });
    });

    describe(`when (!(c3))`, () => {
      describe(`when (c5)`, () => {
        xit(`should be implemented`, () => {
          // ...
        });
      });

      describe(`when (!(c5))`, () => {
        describe(`when (c6)`, () => {
          xit(`should be implemented`, () => {
            // ...
          });
        });

        describe(`when (!(c6))`, () => {
          xit(`should be implemented`, () => {
            // ...
          });
        });
      });
    });
  });

  describe(`when (c7)`, () => {
    xit(`should be implemented`, () => {
      // ...
    });
  });

  describe(`when (!(c7))`, () => {
    xit(`should be implemented`, () => {
      // ...
    });
  });

  describe(`when (c8)`, () => {
    xit(`should be implemented`, () => {
      // ...
    });
  });

  describe(`when (!(c8))`, () => {
    xit(`should be implemented`, () => {
      // ...
    });
  });
});
