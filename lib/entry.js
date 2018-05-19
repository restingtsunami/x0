import path from 'path'
import React from 'react'
import { render, hydrate } from 'react-dom'
import {
  StaticRouter,
  BrowserRouter,
  Route
} from 'react-router-dom'

const IS_CLIENT = typeof document !== 'undefined'
const req = require.context(DIRNAME, false, /\.(js|mdx|jsx)$/)

const { filename } = OPTIONS
const index = filename ? path.basename(filename, path.extname(filename)) : 'index'

const getComponents = req => req.keys().map(key => ({
  key,
  name: path.basename(key, path.extname(key)),
  Component: req(key).default || req(key)
}))
  .filter(component => !/^(\.|_)/.test(component.name))
  .filter(component => typeof component.Component === 'function')

const initialComponents = getComponents(req)

const Router = IS_CLIENT ? BrowserRouter : StaticRouter

export const getRoutes = async (components = initialComponents) => {
  const routes = await components.map(async ({ key, name, Component }) => {
    const exact = name === index
    let pathname = exact ? '/' : '/' + name
    const props = Component.getInitialProps
      ? await Component.getInitialProps({ path: pathname })
      : {}
    if (IS_CLIENT) pathname = props.path || pathname
    return {
      key: name,
      name,
      path: pathname,
      exact,
      Component,
      props
    }
  })
  return Promise.all(routes)
}

export default class App extends React.Component {
  state = this.props

  render () {
    const {
      routes,
      basename = '',
      path = '/'
    } = this.state

    return (
      <Router
        context={{}}
        basename={basename}
        location={path}>
        <React.Fragment>
          {routes.map(({ Component, ...route }) => (
            <Route
              {...route}
              render={props => (
                <Component
                  {...props}
                  {...route.props}
                />
              )}
            />
          ))}
        </React.Fragment>
      </Router>
    )
  }
}

let app
if (IS_CLIENT) {
  const mount = DEV ? render : hydrate
  const div = window.root || document.body.appendChild(
    document.createElement('div')
  )
  getRoutes()
    .then(routes => {
      app = mount(<App routes={routes} />, div)
    })
}

if (IS_CLIENT && module.hot) {
  module.hot.accept(req.id, async () => {
    const next = require.context(DIRNAME, false, /\.(js|mdx|jsx)$/)
    const components = getComponents(next)
    const routes = await getRoutes(components)
    app.setState({ routes })
  })
}
