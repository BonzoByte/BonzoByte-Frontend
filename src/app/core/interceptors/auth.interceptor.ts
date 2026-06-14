import { Injectable, Injector } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@env/environment';
import { getAccessToken } from '../auth-token-storage';
import { AuthService } from '../services/auth.service';

const PUBLIC_AUTH_PATHS = new Set([
    '/auth/login',
    '/auth/register',
    '/auth/forgotPassword',
    '/auth/request-reset-password',
    '/auth/reset-password',
    '/auth/verify-email',
    '/auth/resend-verification',
    '/auth/contact',
    '/auth/google',
    '/auth/facebook',
    '/auth/google/callback',
    '/auth/facebook/callback'
]);

const PUBLIC_AUTH_PREFIXES = [
    '/auth/nickname-exists'
];

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    constructor(private injector: Injector) { }

    intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        const token = getAccessToken();

        // Attach Authorization only to first-party API calls.
        const isApiCall = req.url.startsWith(environment.apiUrl);

        let authReq = req;
        if (token && isApiCall && !req.headers.has('Authorization')) {
            authReq = req.clone({
                setHeaders: { Authorization: `Bearer ${token}` }
            });
        }
        const sentWithAuthorization = authReq.headers.has('Authorization');

        return next.handle(authReq).pipe(
            catchError((err: HttpErrorResponse) => {
                if (shouldClearStaleSession(err, authReq.url, isApiCall, sentWithAuthorization)) {
                    this.injector.get(AuthService).forceClearSession();
                }

                return throwError(() => err);
            })
        );
    }
}

function shouldClearStaleSession(
    err: HttpErrorResponse,
    url: string,
    isApiCall: boolean,
    sentWithAuthorization: boolean
): boolean {
    return err.status === 401
        && isApiCall
        && sentWithAuthorization
        && !isPublicAuthEndpoint(url);
}

function isPublicAuthEndpoint(url: string): boolean {
    const path = getApiRelativePath(url).replace(/\/$/, '');

    return PUBLIC_AUTH_PATHS.has(path)
        || PUBLIC_AUTH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

function getApiRelativePath(url: string): string {
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const requestPath = new URL(url, fallbackOrigin).pathname;
    const apiPath = new URL(environment.apiUrl, fallbackOrigin).pathname.replace(/\/$/, '');

    if (apiPath && requestPath === apiPath) return '/';
    if (apiPath && requestPath.startsWith(`${apiPath}/`)) {
        return requestPath.slice(apiPath.length);
    }

    return requestPath;
}
