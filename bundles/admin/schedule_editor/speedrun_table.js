import React from 'react';
import PropTypes from 'prop-types';

import Speedrun from './speedrun.js';
import EmptyTableDropTarget from './drag_drop/empty_table_drop_target';
import ErrorList from 'ui/public/error_list';

function orderSort(a, b) {
  if (a.order === null && b.order === null) {
    return 0;
  } else if (a.order !== null && b.order === null) {
    return -1;
  } else if (a.order === null && b.order !== null) {
    return 1;
  } else if (a.order < b.order) {
    return -1;
  } else {
    return 1;
  }
}

class Header extends React.Component {
  render() {
    const { title } = this.props;
    return (
      <thead>
        <tr>
          <td colSpan="10" style={{ textAlign: 'center' }}>
            {title}
          </td>
        </tr>
        <tr>
          <th>Start Time</th>
          <th>Order</th>
          <th>Game</th>
          <th>Runners</th>
          <th>Console</th>
          <th>Estimate/Run Time</th>
          <th>Setup</th>
          <th>Description</th>
          <th colSpan="2">Commentators</th>
        </tr>
      </thead>
    );
  }
}

class SpeedrunTable extends React.Component {
  constructor(props) {
    super(props);
    this.newSpeedrun_ = this.newSpeedrun_.bind(this);
  }

  render() {
    const { drafts, event, moveSpeedrun, saveField, saveModel, cancelEdit, editModel, updateField } = this.props;
    const speedruns = [...(this.props.speedruns || [])].sort(orderSort);
    // this is hard as hell to understand and kinda slow so uh maybe clean it up a bit
    return (
      <table className="table table-striped table-condensed small">
        <Header title={event ? event.name : 'All Events'} />
        <tbody>
          {speedruns[0] && speedruns[0].order === null ? (
            <EmptyTableDropTarget
              elementType="tr"
              moveSpeedrun={pk => saveField(speedruns.find(sr => sr.pk === pk), 'order', 1)}>
              <td style={{ textAlign: 'center' }} colSpan="10">
                Drop a run here to start the schedule
              </td>
            </EmptyTableDropTarget>
          ) : null}
          {speedruns.map(speedrun => {
            const { pk } = speedrun;
            const draft = drafts[pk];
            const error = draft && draft._error;
            const fieldErrors = draft && draft._fields && draft._fields.__all__;
            return (
              <React.Fragment key={pk}>
                {error ? (
                  <React.Fragment>
                    {error !== 'Validation Error' ? (
                      <tr key={`error-${pk}`}>
                        <td colSpan="10">
                          <ErrorList errors={[error]} />
                        </td>
                      </tr>
                    ) : null}
                    {fieldErrors ? (
                      <tr key={`error-${pk}-__all__`}>
                        <td colSpan="10">
                          <ErrorList errors={fieldErrors} />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                ) : null}
                <Speedrun
                  key={pk}
                  speedrun={speedrun}
                  draft={draft}
                  moveSpeedrun={moveSpeedrun}
                  saveField={saveField}
                  editModel={editModel}
                  cancelEdit={cancelEdit}
                  saveModel={saveModel}
                  updateField={updateField}
                />
              </React.Fragment>
            );
          })}
          {Object.keys(drafts).map(pk => {
            if (pk >= 0) {
              return null;
            }
            const draft = drafts[pk];
            return (
              <React.Fragment key={pk}>
                {draft && draft._error ? (
                  <React.Fragment>
                    {draft._error !== 'Validation Error' ? (
                      <tr key={`error-${pk}`}>
                        <td colSpan="10">{draft._error}</td>
                      </tr>
                    ) : null}
                    {((draft._fields && draft._fields.__all__) || []).map((error, i) => (
                      <tr key={`error-${pk}-__all__-${i}`}>
                        <td colSpan="10">{error}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ) : null}
                <Speedrun
                  key={pk}
                  speedrun={speedrun}
                  draft={draft}
                  cancelEdit={cancelEdit}
                  saveModel={saveModel}
                  updateField={updateField}
                />
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  }

  newSpeedrun_() {
    this.props.newSpeedrun();
  }
}

SpeedrunTable.propTypes = {
  // TODO
};

export default SpeedrunTable;
