import { TestBed } from '@angular/core/testing';

import { DataHog } from './data-hog';

describe('DataHog', () => {
  let service: DataHog;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataHog);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
