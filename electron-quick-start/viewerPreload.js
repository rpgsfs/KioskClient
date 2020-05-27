const {ipcRenderer} = require('electron');

ipcRenderer.on('pod', (sender, data) => {
  _rpgsfs_ei_pod = data;
});

window.addEventListener('DOMContentLoaded', () => {

  //wait for the viewer to be launched
  onViewerLaunch.push(viewer => {
    const extension = 'RPGSFS.Arpoge.HeadTracking';
    viewer.addEventListener(Autodesk.Viewing.EXTENSION_LOADED_EVENT, event => {
      if (event.extensionId !== extension)
        return;

      const pod = window['_rpgsfs_ei_pod'];
      if (pod === undefined)
        return;

      const headTrackingExtension = viewer.getExtension(extension);
      headTrackingExtension.observePod(pod);
    });
  });
});

function _rpgsfs_ei_kinectToForgeCoordinates(x, y, z) {
   // 6 is the width of the model windows in forge units
   // 600 is the width of the real windows in millimeters (kinect units)
  const scale = 6 / 600;

  // location of kinect in forge
  const kinectX = 0;
  const kinectY = 7;
  const kinectZ = 0;

  return [kinectX + scale * x, kinectY + scale * z, kinectZ - scale * y];
}

let _rpgsfs_ei_manipulate_hands_start = undefined;

// the minimum number of units the user needs to move their head for the 
// program to attempt to update the UI
const headMoveThreshold = 2;
const currentHeadPos = [0, 0, 0];

ipcRenderer.on('kinectData', (sender, data) => {
  try {
      let command = data.split(' ');
      let commandKeyword = command.shift();

      let sound, viewControls, headTracking;
      try {
        sound = viewer.getExtension('RPGSFS.Arpoge.Sound');
        viewControls = viewer.getExtension('RPGSFS.Arpoge.ViewControls');
        headTracking = viewer.getExtension('RPGSFS.Arpoge.HeadTracking');
      } catch (e) {
        if (!e instanceof ReferenceError)
          throw e;
        //if viewer has not been defined
        //leave viewControls and headTracking undefined
      }

      switch(commandKeyword) {
        case '_HEADPOSITION_':
          if (headTracking)
          {
            let coords = command.map(Number.parseFloat);

            let update = false;
            if(Math.abs(currentHeadPos[0] - coords[0]) > headMoveThreshold) {
              console.log('updating x current = %f new = %f', currentHeadPos[0], 
                coords[0]);
              update = true;
              currentHeadPos[0] = coords[0];
            }
            if(Math.abs(currentHeadPos[1] - coords[1]) > headMoveThreshold) {
              console.log('updating y current = %f new = %f', currentHeadPos[1], 
                coords[1]);
              update = true;
              currentHeadPos[1] = coords[1];
            }
            if(Math.abs(currentHeadPos[2] - coords[2]) > headMoveThreshold) {
              console.log('updating z current = %f new = %f', currentHeadPos[2], 
                coords[2]);
              update = true;
              currentHeadPos[2] = coords[2];
            }

            if(update) {
              coords = _rpgsfs_ei_kinectToForgeCoordinates(...coords);
              headTracking.setObserverPosition(...coords);
            }
          }
          break;

        case '_PLAYSOUND_':
          if (sound)
            sound.playSound(command);
          break;

        case '_RESET_':
          if (viewControls)
            viewControls.resetInnerModel();
          break;

        case '_MANIPULATE_':
            _rpgsfs_ei_manipulate_hands_start = undefined;
          break;

        case '_ORBIT_':
          if (viewControls)
          {
            const [lx, ly, lz, rx, ry, rz] = command.map(parseFloat);

            const left = _rpgsfs_ei_kinectToForgeCoordinates(lx, ly, lz);
            const right = _rpgsfs_ei_kinectToForgeCoordinates(rx, ry, rz);

            if (!_rpgsfs_ei_manipulate_hands_start)
              _rpgsfs_ei_manipulate_hands_start = [left, right];

            const [leftStart, rightStart] = _rpgsfs_ei_manipulate_hands_start;

            const ox = leftStart[0] - rightStart[0];
            const oy = leftStart[1] - rightStart[1];
            const oz = leftStart[2] - rightStart[2];

            const nx = left[0] - right[0];
            const ny = left - right[1];
            const nz = left - right;

            viewControls.rotate(ox, oy, oz, nx, ny, nz);
          }
          break;

        case '_EXPLODE_':
          if (viewControls)
          {
            let scale = parseFloat(command[0]);
            viewControls.zoom(scale);
          }
          break;
      }
  }
  catch (e) {
    alert(e);
  }
});
