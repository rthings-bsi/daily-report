const { createElement: e } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const select = e('select', { value: '1', onChange: () => {} }, [
  e('option', { value: '1' }, 'Opt 1'),
  e('option', { value: '2' }, 'Opt 2'),
]);

console.log(renderToStaticMarkup(select));
