import { useCoworkStore } from './views/cowork/CoworkStore';

type StoreType = ReturnType<typeof useCoworkStore>;
type IsNever = [StoreType] extends [never] ? 'yes' : 'no';

const _isNever: IsNever = 'no';
