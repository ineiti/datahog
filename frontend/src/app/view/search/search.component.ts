import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { DataHogService } from '../../data-hog';
import { Node } from 'datahog-npm';

@Component({
  selector: 'view-search',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent implements OnInit, OnDestroy {
  searchQuery = '';
  labelResults: Node[] = [];
  markdownResults: Node[] = [];
  schemaResults: Node[] = [];

  // Navigation state: [columnIndex, rowIndex]
  // columnIndex: 0=Label, 1=Markdown, 2=Schema
  selectedColumn = 0;
  selectedRow = 0;

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  constructor(
    private dh: DataHogService,
    private router: Router,
  ) {}

  async ngOnInit() {
    // Set up debounced search
    this.searchSubscription = this.searchSubject
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
      )
      .subscribe((query) => {
        this.update_search(query);
      });

    // Perform initial empty search to show all nodes
    await this.update_search('');
  }

  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
  }

  onSearchChange(query: string) {
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  async update_search(query: string) {
    const results = await this.dh.searchNodes(query);

    // Filter results by kind into three columns
    this.labelResults = results.filter((node) => node.kind === 'Label');
    this.markdownResults = results.filter((node) => node.kind === 'Markdown');
    this.schemaResults = results.filter((node) => node.kind === 'Schema');

    // Reset selection to first item in first non-empty column
    this.selectedColumn = 0;
    this.selectedRow = 0;
    this.ensureValidSelection();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.moveLeft();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.moveRight();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveUp();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.moveDown();
        break;
      case 'Enter':
        event.preventDefault();
        this.selectCurrentNode();
        break;
    }
  }

  private moveLeft() {
    if (this.selectedColumn > 0) {
      this.selectedColumn--;
      this.ensureValidSelection();
    }
  }

  private moveRight() {
    if (this.selectedColumn < 2) {
      this.selectedColumn++;
      this.ensureValidSelection();
    }
  }

  private moveUp() {
    if (this.selectedRow > 0) {
      this.selectedRow--;
    }
  }

  private moveDown() {
    const currentColumn = this.getCurrentColumn();
    if (this.selectedRow < currentColumn.length - 1) {
      this.selectedRow++;
    }
  }

  private ensureValidSelection() {
    const currentColumn = this.getCurrentColumn();
    if (this.selectedRow >= currentColumn.length) {
      this.selectedRow = Math.max(0, currentColumn.length - 1);
    }
  }

  private getCurrentColumn(): Node[] {
    switch (this.selectedColumn) {
      case 0:
        return this.labelResults;
      case 1:
        return this.markdownResults;
      case 2:
        return this.schemaResults;
      default:
        return [];
    }
  }

  private selectCurrentNode() {
    const currentColumn = this.getCurrentColumn();
    if (currentColumn.length > 0 && this.selectedRow < currentColumn.length) {
      this.navigateToNode(currentColumn[this.selectedRow]);
    }
  }

  navigateToNode(node: Node) {
    this.router.navigate(['/node', node.id.toString()]);
  }

  isSelected(columnIndex: number, rowIndex: number): boolean {
    return this.selectedColumn === columnIndex && this.selectedRow === rowIndex;
  }

  onNodeClick(columnIndex: number, rowIndex: number, node: Node) {
    this.selectedColumn = columnIndex;
    this.selectedRow = rowIndex;
    this.navigateToNode(node);
  }
}
