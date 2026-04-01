import Box from '@mui/material/Box';
import downloadIconInactive from 'assets/toggle_buttons/Download_Icon_Inactive.svg';

function DataDownloadMenuIcon(props) {
  return <Box component="img" src={downloadIconInactive} alt="Data Downloads" sx={{ width: 18, height: 18 }} {...props} />;
}

// ==============================|| MENU ITEMS - DATA DOWNLOAD ||============================== //

const dataDownloadTab = {
  id: 'group-data-download',
  title: 'Data',
  type: 'group',
  children: [
    {
      id: 'data-download',
      title: 'Data Downloads',
      type: 'item',
      url: '/dashboard/data-download',
      icon: DataDownloadMenuIcon,
      breadcrumbs: true
    }
  ]
};

export default dataDownloadTab;
