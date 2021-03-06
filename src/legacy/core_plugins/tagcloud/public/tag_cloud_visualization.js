/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import TagCloud from './tag_cloud';
import * as Rx from 'rxjs';
import { take } from 'rxjs/operators';
import { render, unmountComponentAtNode } from 'react-dom';
import React from 'react';
import { getFormat } from 'ui/visualize/loader/pipeline_helpers/utilities';

import { I18nContext } from 'ui/i18n';
import { Label } from './label';
import { FeedbackMessage } from './feedback_message';

const MAX_TAG_COUNT = 200;

export class TagCloudVisualization {

  constructor(node, vis) {
    this._containerNode = node;

    const cloudContainer = document.createElement('div');
    cloudContainer.classList.add('tgcVis');
    cloudContainer.setAttribute('data-test-subj', 'tagCloudVisualization');
    this._containerNode.appendChild(cloudContainer);

    this._vis = vis;
    this._truncated = false;
    this._tagCloud = new TagCloud(cloudContainer);
    this._tagCloud.on('select', (event) => {
      if (!this._vis.params.bucket) {
        return;
      }
      this._vis.API.events.filter({
        table: event.meta.data, column: 0, row: event.meta.rowIndex
      });
    });
    this._renderComplete$ = Rx.fromEvent(this._tagCloud, 'renderComplete');


    this._feedbackNode = document.createElement('div');
    this._containerNode.appendChild(this._feedbackNode);
    this._feedbackMessage = React.createRef();
    render(<I18nContext><FeedbackMessage ref={this._feedbackMessage} /></I18nContext>, this._feedbackNode);

    this._labelNode = document.createElement('div');
    this._containerNode.appendChild(this._labelNode);
    this._label = React.createRef();
    render(<Label ref={this._label} />, this._labelNode);

  }

  async render(data, status) {
    if (!(status.resize || status.data || status.params)) return;

    if (status.params || status.aggs) {
      this._updateParams();
    }

    if (status.data || status.params) {
      this._updateData(data);
    }


    if (status.resize) {
      this._resize();
    }

    await this._renderComplete$.pipe(take(1)).toPromise();

    if (data.columns.length !== 2) {
      this._feedbackMessage.current.setState({
        shouldShowTruncate: false,
        shouldShowIncomplete: false
      });
      return;
    }

    this._label.current.setState({
      label: `${data.columns[0].name} - ${data.columns[1].name}`,
      shouldShowLabel: this._vis.params.showLabel
    });
    this._feedbackMessage.current.setState({
      shouldShowTruncate: this._truncated,
      shouldShowIncomplete: this._tagCloud.getStatus() === TagCloud.STATUS.INCOMPLETE
    });
  }


  destroy() {
    this._tagCloud.destroy();
    unmountComponentAtNode(this._feedbackNode);
    unmountComponentAtNode(this._labelNode);
  }

  _updateData(data) {
    if (!data || !data.rows.length) {
      this._tagCloud.setData([]);
      return;
    }

    const bucket = this._vis.params.bucket;
    const metric = this._vis.params.metric;
    const bucketFormatter = bucket ? getFormat(bucket.format) : null;
    const tagColumn = bucket ? data.columns[bucket.accessor].id : -1;
    const metricColumn = data.columns[metric.accessor].id;
    const tags = data.rows.map((row, rowIndex) => {
      const tag = row[tagColumn] === undefined ? 'all' : row[tagColumn];
      const metric = row[metricColumn];
      return {
        displayText: bucketFormatter ? bucketFormatter.convert(tag, 'text') : tag,
        rawText: tag,
        value: metric,
        meta: {
          data: data,
          rowIndex: rowIndex,
        }
      };
    });


    if (tags.length > MAX_TAG_COUNT) {
      tags.length = MAX_TAG_COUNT;
      this._truncated = true;
    } else {
      this._truncated = false;
    }

    this._tagCloud.setData(tags);

  }

  _updateParams() {
    this._tagCloud.setOptions(this._vis.params);
  }

  _resize() {
    this._tagCloud.resize();
  }

}
