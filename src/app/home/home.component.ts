import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  ngOnInit(): void {
    document.body.classList.add('no-datebar');
  }

  ngOnDestroy(): void {
    document.body.classList.remove('no-datebar');
  }
}