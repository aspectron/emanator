; Script generated by the Inno Script Studio Wizard.
; SEE THE DOCUMENTATION FOR DETAILS ON CREATING INNO SETUP SCRIPT FILES!

#define MyAppName "<%- title %>"
#define MyAppVersion "<%- package.version %>"
#define MyAppPublisher "<%- author %>"
#define MyAppURL "<%- url %>"
#define MyAppExeName "<%- ident+'.exe' %>"

[Setup]
; NOTE: The value of AppId uniquely identifies this application.
; Do not use the same AppId value in installers for other applications.
; (To generate a new GUID, click Tools | Generate GUID inside the IDE.)
AppId=95BA9908-FF97-4281-8DCA-7461BC9EE058
AppName={#MyAppName}
AppVersion={#MyAppVersion}
;AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={pf64}\Scanz
DisableDirPage=yes
UsePreviousAppDir=no
OutputBaseFilename=<%- ident %>-windows-<%- package.version %><%= suffix %>
OutputDir=..\..\setup
SetupIconFile=<%- path.join(RESOURCES,ident+'.ico') %>
Compression=lzma/normal
SolidCompression=yes
;PrivilegesRequired=admin
AlwaysShowComponentsList=False
ShowComponentSizes=False
RestartIfNeededByRun=False
MinVersion=0,6.0
UserInfoPage=True
DefaultGroupName=<%- group %>
UninstallDisplayIcon={app}\<%- ident %>.exe
CloseApplications=force
; "ArchitecturesAllowed=x64" specifies that Setup cannot run on
; anything but x64.
ArchitecturesAllowed=x64
; "ArchitecturesInstallIn64BitMode=x64" requests that the install be
; done in "64-bit mode" on x64, meaning it should use the native
; 64-bit Program Files directory and the 64-bit view of the registry.
ArchitecturesInstallIn64BitMode=x64
WizardImageFile=<%- path.join(RESOURCES,ident+'-164x314.bmp') %>
WizardSmallImageFile=<%- path.join(RESOURCES,ident+'-55x58.bmp') %>

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}";
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 0,6.1

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
<% 

var fwList = { }

_.each(options.fw, (v,k) => {
  switch(k) {
    case "App": {
      fwList[title] = "{#MyAppExeName}"; 
    } break;

    case "µFabric":
    case "MicroFabric": {
       fwList[title+' NATS'] = "node_modules\\micro-fabric\\bin\\windows\\nats\\gnatsd.exe"; 
       fwList[title+' STAN' ] = "node_modules\\micro-fabric\\bin\\windows\\stan\\nats-streaming-server.exe"; 
    } break;

    default: {
        fwList[k] = v;
    } break;
  }
})

_.each(fwList, (v,k) => {
%>
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""<%- k %>"" program=""{app}\<%- v %>"" dir=in action=allow enable=yes"; Flags: runhidden;
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""<%- k %>"" program=""{app}\<%- v %>"" dir=out action=allow enable=yes"; Flags: runhidden;
<%
}) 
%>
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall

[Files]
Source: "..\build\*"; DestDir: {app}; Flags: recursesubdirs ignoreversion
<% if(options.dependent) { %>
Source: "<%- options.dependent.file %>"; DestDir: {tmp}; 
<% } %>

[InstallDelete]
Type: filesandordirs; Name: "{app}"

<% if(options.dependent) { %>
[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var 
   isDotNetInstalled : Boolean;
   errorCode : Integer;
   errorDesc : String;
begin
   isDotNetInstalled := IsDotNetIntalledCheck();
   if not isDotNetInstalled then 
   begin
      //WizardForm.PreparingLabel.Caption := CustomMessage('InstallingDotNetMsg');
      WizardForm.StatusLabel.Caption := CustomMessage('InstallingDotNetMsg');
      ExtractTemporaryFile('dotNetFx40_Full_x86_x64.exe');
      if  not ShellExec('',ExpandConstant('{tmp}\<%- options.dependent.file %>'),'/passive /norestart', '', SW_HIDE, ewWaitUntilTerminated, errorCode) then
      begin
        errorDesc := SysErrorMessage(errorCode);
        MsgBox(errorDesc, mbError, MB_OK);
      end; 
;      isDotNetInstalled := WasDotNetInstallationSuccessful();
;      if not isDotNetInstalled then
;      begin
;         Result := CustomMessage('FailedToInstalldotNetMsg');
;      end;
   end;
end;
<% } %>

<% if(USE_RAR) { %>
[Run]
Filename: "{app}\package.nw\node-modules.exe"; Parameters: "/s /y"; StatusMsg: "Installing Dependencies..."; Flags: runhidden
Filename: "{app}\package.nw\lib.exe"; Parameters: "/s /y"; StatusMsg: "Installing UI Components..."; Flags: runhidden

[UninstallDelete]
Type: filesandordirs; Name: "{app}\package.nw\node_modules"
Type: filesandordirs; Name: "{app}\package.nw\lib"
<% } %>
