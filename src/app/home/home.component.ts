import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { StaticArchivesService } from '../core/services/static-archives.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  constructor(private archives: StaticArchivesService) {}

  ngOnInit(): void {
    document.body.classList.add('no-datebar');

    setTimeout(() => {
      this.archives.warmUpReferenceIndexes();
    }, 0);
  }

  ngOnDestroy(): void {
    document.body.classList.remove('no-datebar');
  }
}