import { EntityInterface } from '../Entity.d';
import { Selector, Options } from '../Nymph.d';

/**
 * A Nymph database driver.
 */
export default abstract class NymphDriver {
  /**
   * Whether this instance is currently connected to a database.
   */
  public connected = false;
  /**
   * A cache to make entity retrieval faster.
   */
  protected entityCache = [];
  /**
   * A counter for the entity cache to determine the most accessed entities.
   */
  protected entityCount = {};
  /**
   * Sort case sensitively.
   */
  protected sortCaseSensitive = false;
  /**
   * Parent property to sort by.
   */
  protected sortParent: string | null = null;
  /**
   * Property to sort by.
   */
  protected sortProperty: string = 'cdate';

  abstract connect(): boolean;
  abstract deleteEntity(entity: EntityInterface): boolean;
  abstract deleteEntityByID(guid: string, className?: string): boolean;
  abstract deleteUID(name: string): boolean;
  abstract disconnect(): boolean;
  abstract export(filename: string): boolean;
  abstract exportPrint(): boolean;
  abstract getEntities<
    T extends new () => EntityInterface = new () => EntityInterface
  >(options?: Options<T>, ...selectors: Selector[]): InstanceType<T> | null;
  abstract getEntity<
    T extends new () => EntityInterface = new () => EntityInterface
  >(options?: Options<T>, ...selectors: Selector[]): InstanceType<T> | null;
  abstract getUID(name: string): number | null;
  abstract hsort(
    array: EntityInterface[],
    property: string,
    parentProperty: string,
    caseSensitive?: boolean,
    reverse?: boolean
  ): void;
  abstract import(filename: string): boolean;
  abstract newUID(name: string): number | null;
  abstract psort(
    array: EntityInterface[],
    property: string,
    parentProperty: string,
    caseSensitive?: boolean,
    reverse?: boolean
  ): void;
  abstract renameUID(oldName: string, newName: string): boolean;
  abstract saveEntity(entity: EntityInterface): boolean;
  abstract setUID(name: string, value: number): boolean;
  abstract sort(
    array: EntityInterface[],
    property: string,
    caseSensitive?: boolean,
    reverse?: boolean
  ): void;
}
