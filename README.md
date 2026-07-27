# TennisFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.8.

## Local development

To run the frontend against the Brotli archives in the sibling
`StaticFiles/Data/Archives` folder, run:

```bash
npm run start:local
```

This starts the read-only local archive server on port `5001` and Angular on
port `4200`. Archive requests stay local and do not require R2. Authentication
and guarded match-details requests are routed to the BonzoByte backend on port
`5000`, so start the sibling backend separately when testing either feature.
Override the archive folder with `BONZOBYTE_ARCHIVES_ROOT` when the files live
elsewhere.

To run only one side of the local setup:

```bash
npm run start:archives
npm start
```

Once the frontend is running, open `http://localhost:4200/`. The application
automatically reloads whenever you modify a source file.

### Local routing smoke check

With the backend, archive server, and Angular running, verify:

- `http://localhost:4200/api/health` returns the backend health response.
- `http://localhost:4200/api/archives/health` reports `mode: local-brotli`.
- `http://localhost:4200/api/archives/match-details/<id>` is served through the
  backend guard.
- `http://localhost:4200/api/auth/google` and `/api/auth/facebook` redirect to
  their provider instead of returning an archive-route error.

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
