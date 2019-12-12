import generateId from 'uuid/v4';
import Cookies from 'universal-cookie';

const cookie = new Cookies();

// 获取标识
const getId = () => {
  return cookie.get('uuid') || localStorage.getItem('uuid') || generateId();
};

// 注入标识
const injectId = uuid => {
  cookie.set('uuid', uuid, { path: '/', maxAge: 10 * 365 * 24 * 60 * 60 });
  localStorage.setItem('uuid', uuid);
};

const autoInject = () => {
  const uuid = getId();
  injectId(uuid);
};

const UUID = {
  init: autoInject,
  getId: getId,
};

export default UUID;
