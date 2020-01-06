window.addEventListener('DOMContentLoaded', () => {
  //wait for the viewer to be launched
  onViewerLaunch.push(viewer => {
    try {
      for (let extension of _rpgsfs_ei_extensions)
      {
        console.log('Loading ' + extension)
        viewer.loadExtension(extension)
      }
    } catch(e) {
      console.error(e)
      if (!e instanceof ReferenceError)
        throw e;
      //no extensions injected
    }
  });
});

_rpgsfs_ei_acceptData = function(data) {
  try {
      let command = data.split(' ');
      let commandKeyword = command.shift();

      let viewControls, headTracking;
      try {
        viewControls = viewer.getExtension('RPGSFS.Arpoge.ViewControls');
        headTracking = viewer.getExtension('RPGSFS.Arpoge.HeadTracking');
      } catch (e) {
      	if (!e instanceof ReferenceError)
      		throw e;
        //if viewer has not been defined
        //leave viewControls and headTracking undefined
      }

      switch(commandKeyword) {
        case '_RESET_':
          if (viewer)
          {
            resetInnerModel();
          }
          break;
        case '_HEADPOSITION_':
          if (headTracking && model)
          {
            // alert('tracking head');
            let coords = command.map(parseFloat).map(x => x / 10);
            headTracking.setObserverPosition(...coords);
          }
          break;

        case '_ORBIT_':
          if (headTracking && miniModel)
          {
            let coords = command.map(parseFloat);
            headTracking.rotate(...coords);
          }
          break;

        case '_PLAYSOUND_':
          if (viewControls)
            viewControls.playSound(command);
          break;

        case '_EXPLODE_':
          if (headTracking && miniModel)
          {
            let scale = parseFloat(command[0]);
            headTracking.zoom(scale);
          }
          break;
      }
  }
  catch (e) {
    alert(e);
  }
}
