/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import Boom from 'boom';
import _ from 'lodash';
import { i18n } from '@kbn/i18n';

import { callWithRequestFactory } from '../client/call_with_request_factory';
import { isAnnotationsFeatureAvailable } from '../lib/check_annotations';
import { wrapError } from '../client/errors';
import { annotationServiceProvider } from '../models/annotation_service';

import { ANNOTATION_USER_UNKNOWN } from '../../common/constants/annotations';

function getAnnotationsFeatureUnavailableErrorMessage() {
  return Boom.badRequest(
    i18n.translate('xpack.ml.routes.annotations.annotationsFeatureUnavailableErrorMessage', {
      defaultMessage: 'Index and aliases required for the annotations feature have not been created.',
    })
  );
}
export function annotationRoutes(server, commonRouteConfig) {
  server.route({
    method: 'POST',
    path: '/api/ml/annotations',
    handler(request) {
      const callWithRequest = callWithRequestFactory(server, request);
      const { getAnnotations } = annotationServiceProvider(callWithRequest);
      return getAnnotations(request.payload)
        .catch(resp => wrapError(resp));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'PUT',
    path: '/api/ml/annotations/index',
    async handler(request) {
      const annotationsFeatureAvailable = await isAnnotationsFeatureAvailable(server);
      if (annotationsFeatureAvailable === false) {
        return getAnnotationsFeatureUnavailableErrorMessage();
      }

      const callWithRequest = callWithRequestFactory(server, request);
      const { indexAnnotation } = annotationServiceProvider(callWithRequest);
      const username = _.get(request, 'auth.credentials.username', ANNOTATION_USER_UNKNOWN);
      return indexAnnotation(request.payload, username)
        .catch(resp => wrapError(resp));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'DELETE',
    path: '/api/ml/annotations/delete/{annotationId}',
    async handler(request) {
      const annotationsFeatureAvailable = await isAnnotationsFeatureAvailable(server);
      if (annotationsFeatureAvailable === false) {
        return getAnnotationsFeatureUnavailableErrorMessage();
      }

      const callWithRequest = callWithRequestFactory(server, request);
      const annotationId = request.params.annotationId;
      const { deleteAnnotation } = annotationServiceProvider(callWithRequest);
      return deleteAnnotation(annotationId)
        .catch(resp => wrapError(resp));
    },
    config: {
      ...commonRouteConfig
    }
  });

}
