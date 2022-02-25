import Basic from './basic';
import config from './config';
fixture `test Login`
  .page `${config.baseUrl}`;
const basic = new Basic();
test('testLogin', async () => {
  basic.login('karpovrt', '123');
  basic.logout();
});
