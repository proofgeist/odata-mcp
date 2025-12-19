import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ODataApiClient } from "fmodata";
import type { ODataConfig } from "../server.js";
import { TextToClipboardSchema } from "../types.js";
import { execSync } from "child_process";
import { platform } from "os";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Embedded AppleScript for converting XML to FileMaker clipboard object
 * Based on the fmObjectTranslator script
 */
const APPLESCRIPT_TEMPLATE = `
on run argv
  set xmlString to item 1 of argv
  
  -- Load the fmObjectTranslator
  set objTrans to fmObjectTranslator_Instantiate({})
  set debugMode of objTrans to false
  
  -- Convert XML to FileMaker Objects and set clipboard
  set success to clipboardSetObjectsUsingXML(xmlString) of objTrans
  
  if success then
    return "success"
  else
    error "Failed to set clipboard"
  end if
end run

on fmObjectTranslator_Instantiate(prefs)
  script fmObjectTranslator
    property ScriptName : "FM Object Translator"
    property fmObjectList : {}
    property tempDataName : "temp.data"
    property tempXMLName : "temp.xml"
    property prettyTempName : "pretty-temp.xml"
    property charEOT : ASCII character 3
    property charLF : ASCII character 10
    property charCR : ASCII character 13
    property badLayoutCodeStart : "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>" & charLF & "<Layout" & (ASCII character 10) & " enclosingRectTop=\\""
    property goodLayoutCodeStart : "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>" & charLF & "<Layout enclosingRectTop=\\""
    property xmlHeader : "<fmxmlsnippet type=\\"FMObjectList\\">"
    property xmlFooter : "</fmxmlsnippet>"
    property xmlHeader_LO_Line1 : "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>"
    property xmlHeader_LO_Line2 : "<fmxmlsnippet type=\\"LayoutObjectList\\">"
    property xmlHeader_LO_LIST : {xmlHeader_LO_Line1 & xmlHeader_LO_Line2, xmlHeader_LO_Line1 & charLF & xmlHeader_LO_Line2, xmlHeader_LO_Line1 & charCR & xmlHeader_LO_Line2, xmlHeader_LO_Line1 & charCR & charLF & xmlHeader_LO_Line2}
    property xmlHeader_LO_current : ""
    property fmObjCodes : {¬
      {objName:"Step", objCode:"XMSS"}, ¬
      {objName:"Layout", objCode:"XML2", secondaryNode:"NOT ObjectStyle"}, ¬
      {objName:"Layout", objCode:"XMLO", secondaryNode:"HAS ObjectStyle"}, ¬
      {objName:"Group", objCode:"XMSC"}, ¬
      {objName:"Script", objCode:"XMSC"}, ¬
      {objName:"Field", objCode:"XMFD"}, ¬
      {objName:"CustomFunction", objCode:"XMFN"}, ¬
      {objName:"BaseTable", objCode:"XMTB"}, ¬
      {objName:"ValueList", objCode:"XMVL"} ¬
    }
    property currentCode : ""
    property debugMode : false
    property codeAsXML : ""
    property codeAsObjects : ""
    property shouldPrettify : false
    property shouldSimpleFormat : false
    
    on run
      set fmObjectList to {}
      repeat with oneObject in fmObjCodes
        set oneCode to objCode of oneObject
        set oneClass to classFromCode(oneCode)
        set oneSecondaryNode to ""
        try
          set oneSecondaryNode to secondaryNode of oneObject
        end try
        copy {objName:objName of oneObject, objCode:objCode of oneObject, objClass:oneClass, secondaryNode:oneSecondaryNode} to end of fmObjectList
      end repeat
    end run
    
    on clipboardSetObjectsUsingXML(prefs)
      if class of prefs is string then
        set stringFmXML to prefs
      else if class of prefs is equal to class of {test:"TEST"} then
        set stringFmXML to stringFmXML of prefs
      end if
      
      if not checkStringForValidXML(stringFmXML) then
        return false
      end if
      
      try
        set fmObjects to convertXmlToObjects(stringFmXML)
      on error errMsg number errNum
        return false
      end try
      set the clipboard to fmObjects
      
      return true
    end clipboardSetObjectsUsingXML
    
    on convertXmlToObjects(stringFmXML)
      set stringIsValidXML to checkStringForValidXML(stringFmXML)
      if not stringIsValidXML then
        error "XML does not contain valid FileMaker objects." number 1024
      end if
      
      set fmClass to currentClass()
      set stringLength to length of stringFmXML
      set tempXMLPosix to (makeTempDirPosix() & tempXMLName)
      set xmlFilePath to (POSIX file tempXMLPosix) as string
      set xmlHandle to open for access file xmlFilePath with write permission
      write stringFmXML to xmlHandle as «class utf8»
      close access xmlHandle
      set fmObjects to read alias xmlFilePath as fmClass
      
      return fmObjects
    end convertXmlToObjects
    
    on checkStringForValidXML(someString)
      try
        tell application "System Events"
          set xmlData to make new XML data with data someString
          set fmObjectName to name of XML element 1 of XML element 1 of xmlData
        end tell
      on error errMsg number errNum
        if errNum is -1700 then
          return false
        else if errNum is -1719 then
          return false
        else if errNum is -2753 then
          return false
        else
          error errMsg number errNum
        end if
      end try
      
      set currentCode to ""
      repeat with oneObjectType in fmObjectList
        if (fmObjectName is objName of oneObjectType) then
          if fmObjectName is "Layout" then
            set secondaryNode to word 2 of secondaryNode of oneObjectType
            if word 1 of secondaryNode of oneObjectType is "HAS" then
              set secondaryNodeShouldExist to true
            else
              set secondaryNodeShouldExist to false
            end if
            
            tell application "System Events"
              set secondaryNodeDoesExist to exists (first XML element of XML element 1 of XML element 1 of xmlData whose name is "ObjectStyle")
            end tell
            
            if secondaryNodeShouldExist is equal to secondaryNodeDoesExist then
              set currentCode to objCode of oneObjectType
              set objectType to objClass of oneObjectType
              exit repeat
            end if
          else
            set currentCode to objCode of oneObjectType
            set objectType to objClass of oneObjectType
            exit repeat
          end if
        end if
      end repeat
      
      if length of currentCode is 0 then
        return false
      else
        return true
      end if
    end checkStringForValidXML
    
    on currentClass()
      return classFromCode(currentCode)
    end currentClass
    
    on classFromCode(objCode)
      return run script "«class " & objCode & "»"
    end classFromCode
    
    on makeTempDirPosix()
      set dirPosix to (do shell script "mktemp -d -t tempFMObject") & "/"
      return dirPosix
    end makeTempDirPosix
  end script
  
  run fmObjectTranslator
  return fmObjectTranslator
end fmObjectTranslator_Instantiate
`;

/**
 * Interface for ProofChat API request
 */
interface ProofChatAPIRequest {
  text: string;
  modelConfigs: {
    "Main Chat": {
      provider: string;
      apiKey: string;
      modelName: string;
      customEndpoint: string;
    };
  };
  license: string;
  activationData: string;
  useBatchProcessing: boolean;
}

/**
 * Interface for ProofChat API response
 */
interface ProofChatAPIResponse {
  xml: string;
  success: boolean;
}

/**
 * Store ProofChat configuration at module level
 */
let proofchatConfig: Pick<
  ODataConfig,
  | "proofchatFmSecret"
  | "proofchatLicenseKey"
  | "proofchatActivationData"
  | "proofchatOpenAIKey"
> = {};

/**
 * Create tool definitions for clipboard operations
 */
export function createClipboardTools(
  _client: ODataApiClient,
  config: ODataConfig,
): Tool[] {
  // Store ProofChat config for use in tool handler
  proofchatConfig = {
    proofchatFmSecret: config.proofchatFmSecret,
    proofchatLicenseKey: config.proofchatLicenseKey,
    proofchatActivationData: config.proofchatActivationData,
    proofchatOpenAIKey: config.proofchatOpenAIKey,
  };

  return [
    {
      name: "fmodata_text_to_clipboard",
      description:
        "Converts human-readable FileMaker script text into valid FileMaker XML and places it on the macOS clipboard as a FileMaker object that can be pasted into FileMaker. " +
        "IMPORTANT WORKFLOW: (1) First, write the complete FileMaker script in readable text format and display it to the user in a markdown code block for review. " +
        "(2) Only after the user has reviewed and approved the script text should you call this tool to convert and place it on the clipboard. " +
        "This tool is for CONVERSION only, not generation. The script must be written and shown to the user first. (macOS only)",
      inputSchema: TextToClipboardSchema as Tool["inputSchema"],
    },
  ];
}

/**
 * Call ProofChat API to convert text to FileMaker XML
 */
async function convertTextToXML(text: string): Promise<string> {
  const secret = proofchatConfig.proofchatFmSecret;
  const licenseKey = proofchatConfig.proofchatLicenseKey;
  const activationData = proofchatConfig.proofchatActivationData;
  const openaiKey = proofchatConfig.proofchatOpenAIKey;

  if (!secret || !licenseKey || !activationData || !openaiKey) {
    throw new Error(
      "Missing required ProofChat configuration: proofchatFmSecret, proofchatLicenseKey, proofchatActivationData, proofchatOpenAIKey. " +
      "These can be set via MCP server configuration or environment variables (PROOFCHAT_FM_SECRET, PROOFCHAT_LICENSE_KEY, PROOFCHAT_ACTIVATION_DATA, OPENAI_API_KEY).",
    );
  }

  const requestBody: ProofChatAPIRequest = {
    text,
    modelConfigs: {
      "Main Chat": {
        provider: "OpenAI",
        apiKey: openaiKey,
        modelName: "gpt-4.1-mini",
        customEndpoint: "",
      },
    },
    license: licenseKey,
    activationData: activationData,
    useBatchProcessing: false,
  };

  const response = await fetch("https://app.proofchat.ai/api/fm-txt-to-xml", {
    method: "POST",
    headers: {
      "x-fm-secret": secret,
      "x-license-key": licenseKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ProofChat API request failed: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const data: ProofChatAPIResponse = await response.json();

  if (!data.success) {
    throw new Error("ProofChat API returned success=false");
  }

  return data.xml;
}

/**
 * Execute AppleScript to set clipboard with XML
 */
function setClipboardViaAppleScript(xml: string): void {
  // Check platform
  if (platform() !== "darwin") {
    throw new Error(
      "This tool only works on macOS (requires AppleScript support)",
    );
  }

  // Create temp directory and files
  const tempDir = mkdtempSync(join(tmpdir(), "fmodata-"));
  const xmlFilePath = join(tempDir, "script.xml");
  const scriptFilePath = join(tempDir, "converter.scpt");

  try {
    // Write XML to temp file
    writeFileSync(xmlFilePath, xml, "utf8");

    // Create complete AppleScript that reads XML from file
    const fileBasedScript = `
on run argv
  set xmlFilePath to item 1 of argv
  
  -- Read XML from file
  set xmlString to read POSIX file xmlFilePath as «class utf8»
  
  -- Load the fmObjectTranslator
  set objTrans to fmObjectTranslator_Instantiate({})
  set debugMode of objTrans to false
  
  -- Convert XML to FileMaker Objects and set clipboard
  set success to clipboardSetObjectsUsingXML(xmlString) of objTrans
  
  if success then
    return "success"
  else
    error "Failed to set clipboard"
  end if
end run

on fmObjectTranslator_Instantiate(prefs)
  script fmObjectTranslator
    property ScriptName : "FM Object Translator"
    property fmObjectList : {}
    property tempDataName : "temp.data"
    property tempXMLName : "temp.xml"
    property prettyTempName : "pretty-temp.xml"
    property charEOT : ASCII character 3
    property charLF : ASCII character 10
    property charCR : ASCII character 13
    property badLayoutCodeStart : "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>" & charLF & "<Layout" & (ASCII character 10) & " enclosingRectTop=\\""
    property goodLayoutCodeStart : "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>" & charLF & "<Layout enclosingRectTop=\\""
    property xmlHeader : "<fmxmlsnippet type=\\"FMObjectList\\">"
    property xmlFooter : "</fmxmlsnippet>"
    property xmlHeader_LO_Line1 : "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>"
    property xmlHeader_LO_Line2 : "<fmxmlsnippet type=\\"LayoutObjectList\\">"
    property xmlHeader_LO_LIST : {xmlHeader_LO_Line1 & xmlHeader_LO_Line2, xmlHeader_LO_Line1 & charLF & xmlHeader_LO_Line2, xmlHeader_LO_Line1 & charCR & xmlHeader_LO_Line2, xmlHeader_LO_Line1 & charCR & charLF & xmlHeader_LO_Line2}
    property xmlHeader_LO_current : ""
    property fmObjCodes : {¬
      {objName:"Step", objCode:"XMSS"}, ¬
      {objName:"Layout", objCode:"XML2", secondaryNode:"NOT ObjectStyle"}, ¬
      {objName:"Layout", objCode:"XMLO", secondaryNode:"HAS ObjectStyle"}, ¬
      {objName:"Group", objCode:"XMSC"}, ¬
      {objName:"Script", objCode:"XMSC"}, ¬
      {objName:"Field", objCode:"XMFD"}, ¬
      {objName:"CustomFunction", objCode:"XMFN"}, ¬
      {objName:"BaseTable", objCode:"XMTB"}, ¬
      {objName:"ValueList", objCode:"XMVL"} ¬
    }
    property currentCode : ""
    property debugMode : false
    property codeAsXML : ""
    property codeAsObjects : ""
    property shouldPrettify : false
    property shouldSimpleFormat : false
    
    on run
      set fmObjectList to {}
      repeat with oneObject in fmObjCodes
        set oneCode to objCode of oneObject
        set oneClass to classFromCode(oneCode)
        set oneSecondaryNode to ""
        try
          set oneSecondaryNode to secondaryNode of oneObject
        end try
        copy {objName:objName of oneObject, objCode:objCode of oneObject, objClass:oneClass, secondaryNode:oneSecondaryNode} to end of fmObjectList
      end repeat
    end run
    
    on clipboardSetObjectsUsingXML(prefs)
      if class of prefs is string then
        set stringFmXML to prefs
      else if class of prefs is equal to class of {test:"TEST"} then
        set stringFmXML to stringFmXML of prefs
      end if
      
      if not checkStringForValidXML(stringFmXML) then
        return false
      end if
      
      try
        set fmObjects to convertXmlToObjects(stringFmXML)
      on error errMsg number errNum
        return false
      end try
      set the clipboard to fmObjects
      
      return true
    end clipboardSetObjectsUsingXML
    
    on convertXmlToObjects(stringFmXML)
      set stringIsValidXML to checkStringForValidXML(stringFmXML)
      if not stringIsValidXML then
        error "XML does not contain valid FileMaker objects." number 1024
      end if
      
      set fmClass to currentClass()
      set stringLength to length of stringFmXML
      set tempXMLPosix to (makeTempDirPosix() & tempXMLName)
      set xmlFilePath to (POSIX file tempXMLPosix) as string
      set xmlHandle to open for access file xmlFilePath with write permission
      write stringFmXML to xmlHandle as «class utf8»
      close access xmlHandle
      set fmObjects to read alias xmlFilePath as fmClass
      
      return fmObjects
    end convertXmlToObjects
    
    on checkStringForValidXML(someString)
      try
        tell application "System Events"
          set xmlData to make new XML data with data someString
          set fmObjectName to name of XML element 1 of XML element 1 of xmlData
        end tell
      on error errMsg number errNum
        if errNum is -1700 then
          return false
        else if errNum is -1719 then
          return false
        else if errNum is -2753 then
          return false
        else
          error errMsg number errNum
        end if
      end try
      
      set currentCode to ""
      repeat with oneObjectType in fmObjectList
        if (fmObjectName is objName of oneObjectType) then
          if fmObjectName is "Layout" then
            set secondaryNode to word 2 of secondaryNode of oneObjectType
            if word 1 of secondaryNode of oneObjectType is "HAS" then
              set secondaryNodeShouldExist to true
            else
              set secondaryNodeShouldExist to false
            end if
            
            tell application "System Events"
              set secondaryNodeDoesExist to exists (first XML element of XML element 1 of XML element 1 of xmlData whose name is "ObjectStyle")
            end tell
            
            if secondaryNodeShouldExist is equal to secondaryNodeDoesExist then
              set currentCode to objCode of oneObjectType
              set objectType to objClass of oneObjectType
              exit repeat
            end if
          else
            set currentCode to objCode of oneObjectType
            set objectType to objClass of oneObjectType
            exit repeat
          end if
        end if
      end repeat
      
      if length of currentCode is 0 then
        return false
      else
        return true
      end if
    end checkStringForValidXML
    
    on currentClass()
      return classFromCode(currentCode)
    end currentClass
    
    on classFromCode(objCode)
      return run script "«class " & objCode & "»"
    end classFromCode
    
    on makeTempDirPosix()
      set dirPosix to (do shell script "mktemp -d -t tempFMObject") & "/"
      return dirPosix
    end makeTempDirPosix
  end script
  
  run fmObjectTranslator
  return fmObjectTranslator
end fmObjectTranslator_Instantiate
`;

    writeFileSync(scriptFilePath, fileBasedScript, "utf8");

    // Execute AppleScript with XML file path as argument
    const result = execSync(`osascript "${scriptFilePath}" "${xmlFilePath}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (!result.includes("success")) {
      throw new Error("AppleScript did not return success");
    }

    // Clean up temp files
    unlinkSync(xmlFilePath);
    unlinkSync(scriptFilePath);
  } catch (error) {
    // Clean up on error
    try {
      unlinkSync(xmlFilePath);
      unlinkSync(scriptFilePath);
    } catch {}

    if (error instanceof Error) {
      throw new Error(`Failed to execute AppleScript: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Handle clipboard tool execution
 */
export async function handleClipboardTool(
  _client: ODataApiClient,
  name: string,
  args: unknown,
): Promise<unknown> {
  switch (name) {
    case "fmodata_text_to_clipboard": {
      const { text } = args as { text: string };

      try {
        // Step 1: Convert text to XML via API
        const xml = await convertTextToXML(text);

        // Step 2: Set clipboard via AppleScript
        setClipboardViaAppleScript(xml);

        return {
          success: true,
          message:
            "FileMaker script has been converted to XML and placed on the clipboard. You can now paste it into FileMaker.",
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
    default:
      throw new Error(`Unknown clipboard tool: ${name}`);
  }
}

