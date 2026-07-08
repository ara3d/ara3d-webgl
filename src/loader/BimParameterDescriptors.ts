import { StringIndex } from './bimData'

export interface BimParameterDescriptors {
    Name: Array<StringIndex>;
    Units: Array<StringIndex>;
    Group: Array<StringIndex>;
    Type: Array<number>;
}
