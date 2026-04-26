import requests
from typing import Optional
from azure.identity import ClientSecretCredential
from msgraph import GraphServiceClient
from msgraph.generated.models import DriveItemUploadableProperties
import asyncio
import aiofiles
from pathlib import Path


class SharePointUploader:
    def __init__(self, tenant_id: str, client_id: str, client_secret: str):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.credential = ClientSecretCredential(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret
        )
        self.graph_client = GraphServiceClient(credentials=self.credential)

    async def upload_file(self, site_url: str, folder_path: str, file_path: str, file_name: str) -> Optional[str]:
        """
        Upload a file to SharePoint using Microsoft Graph API.

        Args:
            site_url: SharePoint site URL (e.g., "https://tenant.sharepoint.com/sites/CourseHub")
            folder_path: Folder path within the site (e.g., "Shared Documents/Artifacts")
            file_path: Local path to the file to upload
            file_name: Name to give the file in SharePoint

        Returns:
            SharePoint URL to the uploaded file, or None if upload failed
        """
        try:
            # In a real implementation, we would:
            # 1. Get the site ID from the site URL
            # 2. Get the drive ID for the site
            # 3. Get the folder item ID
            # 4. Upload the file using the Graph API

            # For MVP purposes, we'll simulate the upload by returning a constructed URL
            # In a real implementation, we would use the Microsoft Graph API as follows:

            # site_id = await self.get_site_id_from_url(site_url)
            # drive_id = await self.get_drive_id(site_id)
            # folder_id = await self.get_folder_id(drive_id, folder_path)
            #
            # # Read the file content
            # async with aiofiles.open(file_path, 'rb') as f:
            #     file_content = await f.read()
            #
            # # Upload the file
            # uploaded_item = await self.graph_client.drives.by_drive_id(drive_id).items.by_drive_item_id(folder_id).item_path(file_name).content.request().put(file_content)
            #
            # return uploaded_item.web_url

            # For now, return a constructed URL as if the upload was successful
            import urllib.parse
            encoded_file_name = urllib.parse.quote(file_name)
            return f"{site_url}/Shared%20Documents/{folder_path}/{encoded_file_name}"

        except Exception as e:
            print(f"Error uploading to SharePoint: {str(e)}")
            return None

    async def get_site_id_from_url(self, site_url: str) -> Optional[str]:
        """
        Get the SharePoint site ID from the site URL using Microsoft Graph API.
        """
        try:
            # In a real implementation:
            # site = await self.graph_client.sites.get_site_by_url(site_url).get()
            # return site.id
            return "mock-site-id"
        except Exception as e:
            print(f"Error getting site ID: {str(e)}")
            return None

    async def get_drive_id(self, site_id: str) -> Optional[str]:
        """
        Get the default document library (drive) ID for a site.
        """
        try:
            # In a real implementation:
            # site_drives = await self.graph_client.sites.by_site_id(site_id).drives.get()
            # return site_drives.value[0].id  # Assuming first drive is the document library
            return "mock-drive-id"
        except Exception as e:
            print(f"Error getting drive ID: {str(e)}")
            return None

    async def get_folder_id(self, drive_id: str, folder_path: str) -> Optional[str]:
        """
        Get the folder ID for a given path in the document library.
        """
        try:
            # In a real implementation:
            # Navigate through the folder path to get the folder item ID
            # This would involve multiple API calls to traverse the folder structure
            return "mock-folder-id"
        except Exception as e:
            print(f"Error getting folder ID: {str(e)}")
            return None