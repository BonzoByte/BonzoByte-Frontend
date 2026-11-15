// Game-only responsive checks, synthetic state, one browser at a time.
module.exports = function (config) {
  config.set({
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [require('karma-jasmine'), require('karma-chrome-launcher'), require('@angular-devkit/build-angular/plugins/karma')],
    reporters: ['dots'],
    customLaunchers: {
      TennisDesktop: { base: 'ChromeHeadless', flags: ['--window-size=1280,900', '--force-device-scale-factor=1'] },
      TennisMobile: { base: 'ChromeHeadless', flags: ['--window-size=390,844', '--force-device-scale-factor=1'] },
    },
    browsers: ['TennisDesktop', 'TennisMobile'],
    singleRun: true,
    concurrency: 1,
  });
};
