import { Component, ElementRef, HostListener, inject, ViewChild } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogClose,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Data, DataService, DataView } from '../data.service';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { NgFor, NgIf } from '@angular/common';

@Component({
  selector: 'app-node-editor',
  imports: [MatDialogTitle, MatDialogContent, MatSelectModule, MatInputModule, MatFormFieldModule, FormsModule,
    MatButtonModule, MatDialogActions, MatDialogClose, NgIf, NgFor],
  templateUrl: './node-editor.component.html',
  styleUrl: './node-editor.component.scss'
})
export class NodeEditorComponent {
  @ViewChild('labelInput', { static: true }) labelInput!: ElementRef<HTMLInputElement>;
  data: Data = inject(MAT_DIALOG_DATA);
  label: string;
  dataView?: DataView;
  dataService = inject(DataService);
  readonly dialogRef = inject(MatDialogRef<NodeEditorComponent>);

  constructor() {
    this.label = this.data.label;
    this.dataView = this.data.getView();
  }

  ngOnInit() {
    setTimeout(() => {
      this.labelInput.nativeElement.select();
    }, 100);
  }

  @HostListener('window:keyup.Enter')
  update() {
    this.data.label = this.label;
    if (this.dataView) {
      this.data.data = JSON.stringify(this.dataView);
    }
    this.dataService.setData(this.data);
    this.dialogRef.close();
  }
}
