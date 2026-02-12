import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@env/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        const token = localStorage.getItem('token');

        // Dodaj Authorization samo za na�e API pozive
        const isApiCall = req.url.startsWith(environment.apiUrl);

        let authReq = req;
        if (token && isApiCall && !req.headers.has('Authorization')) {
            authReq = req.clone({
                setHeaders: { Authorization: `Bearer ${token}` }
            });
        }

        return next.handle(authReq).pipe(
            catchError((err: HttpErrorResponse) => {
                // po �elji: globalno hvatanje 401 itd.
                return throwError(() => err);
            })
        );
    }
}
