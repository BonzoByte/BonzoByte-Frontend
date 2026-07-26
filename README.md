# TennisFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.8.

## Local development

To run the frontend against the Brotli archives in the sibling
`StaticFiles/Data/Archives` folder, run:

```bash
npm run start:local
```

This starts the read-only local archive server on port `5000` and Angular on
port `4200`. It does not require the hosted API or R2. Override the archive
folder with `BONZOBYTE_ARCHIVES_ROOT` when the files live elsewhere.

To run only one side of the local setup:

```bash
npm run start:archives
npm start
```

Once the frontend is running, open `http://localhost:4200/`. The application
automatically reloads whenever you modify a source file.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs. 

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
