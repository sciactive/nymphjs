import type { Nymph } from '../Nymph';
import { EntityConstructor, EntityInterface } from '../Entity.types';
import { Options, Selector } from '../Nymph.types';
import NymphDriver from './NymphDriver';

const MSG = 'Nymph is not yet initialized!';

export default class PreInitializedDriver extends NymphDriver {
  connect(): Promise<boolean> {
    throw new Error(MSG);
  }
  isConnected(): boolean {
    throw new Error(MSG);
  }
  startTransaction(_name: string): Promise<Nymph> {
    throw new Error(MSG);
  }
  commit(_name: string): Promise<boolean> {
    throw new Error(MSG);
  }
  rollback(_name: string): Promise<boolean> {
    throw new Error(MSG);
  }
  inTransaction(): Promise<boolean> {
    throw new Error(MSG);
  }
  deleteEntityByID(
    _guid: string,
    _className?: EntityConstructor | string | null
  ): Promise<boolean> {
    throw new Error(MSG);
  }
  deleteUID(_name: string): Promise<boolean> {
    throw new Error(MSG);
  }
  disconnect(): Promise<boolean> {
    throw new Error(MSG);
  }
  protected exportEntities(_writeLine: (line: string) => void): Promise<void> {
    throw new Error(MSG);
  }
  getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string[]>;
  getEntities<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']>[]>;
  getEntities<T extends EntityConstructor = EntityConstructor>(
    _options: Options<T> = {},
    ..._selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']>[] | string[]> {
    throw new Error(MSG);
  }
  protected getEntitiesSync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): string[];
  protected getEntitiesSync<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): ReturnType<T['factorySync']>[];
  protected getEntitiesSync<T extends EntityConstructor = EntityConstructor>(
    _options: Options<T> = {},
    ..._selectors: Selector[]
  ): ReturnType<T['factorySync']>[] | string[] {
    throw new Error(MSG);
  }
  getUID(_name: string): Promise<number | null> {
    throw new Error(MSG);
  }
  import(_filename: string): Promise<boolean> {
    throw new Error(MSG);
  }
  newUID(_name: string): Promise<number | null> {
    throw new Error(MSG);
  }
  renameUID(_oldName: string, _newName: string): Promise<boolean> {
    throw new Error(MSG);
  }
  saveEntity(_entity: EntityInterface): Promise<boolean> {
    throw new Error(MSG);
  }
  setUID(_name: string, _value: number): Promise<boolean> {
    throw new Error(MSG);
  }
}
