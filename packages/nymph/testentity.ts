import { Entity } from './src';

type MyEntityData = { test: string };

class MyEntity extends Entity {
  static ETYPE: 'my_entity';
  static class: 'MyEntity';
}

const myEntity = new MyEntity() as MyEntity & MyEntityData;
myEntity.test = 'hello';
