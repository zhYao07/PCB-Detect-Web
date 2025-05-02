import React from 'react';
import { Route, Redirect } from 'react-router-dom';

const PrivateRoute = ({ children, ...rest }) => {
      const token = localStorage.getItem('token');

      return (
            <Route
                  {...rest}
                  render={({ location }) =>
                        token ? (
                              children
                        ) : (
                              <Redirect
                                    to={{
                                          pathname: "/auth",
                                          state: { from: location }
                                    }}
                              />
                        )
                  }
            />
      );
};

export default PrivateRoute; 