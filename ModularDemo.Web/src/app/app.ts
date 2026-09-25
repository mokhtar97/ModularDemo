import { Component } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ContentNode } from './content/content.models';
import { contentApi } from './content/content.api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  /** Home node + its children = the site navigation. */
  protected readonly home = httpResource<ContentNode>(() => contentApi.byUrl('/', 1));
}
