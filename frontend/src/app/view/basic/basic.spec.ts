import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Basic } from './basic';

describe('Basic', () => {
  let component: Basic;
  let fixture: ComponentFixture<Basic>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Basic]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Basic);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
