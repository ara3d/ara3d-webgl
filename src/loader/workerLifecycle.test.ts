import { describe, expect, it } from 'vitest';
import { disposeBuildInstancesWorkerClient } from './buildInstances';
import { disposeMergeWorkerClient } from './buildGeometryGroup';
import { disposeBimOpenSchemaWorkers } from './bimOpenSchemaLoader';

describe('worker lifecycle helpers', () => {
    it('are idempotent when workers were never created', () => {
        expect(() => {
            disposeBuildInstancesWorkerClient();
            disposeMergeWorkerClient();
            disposeBimOpenSchemaWorkers();
            disposeBuildInstancesWorkerClient();
            disposeMergeWorkerClient();
            disposeBimOpenSchemaWorkers();
        }).not.toThrow();
    });
});
