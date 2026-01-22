import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ODataApiClient } from "fmodata";
import type { ODataConfig } from "../server.js";
import { TextToClipboardSchema } from "../types.js";
import { execSync } from "child_process";
import { platform } from "os";
import { writeFileSync, unlinkSync, mkdtempSync, readFileSync, existsSync } from "fs";
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
 * Split script into chunks for batch processing.
 * Splits by size, attempting to break at logical boundaries (blank lines, end of steps).
 */
function splitScriptIntoChunks(text: string, maxChunkSize: number = 15000): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;
  
  // Look for good break points: blank lines or lines that look like step endings
  const isGoodBreakPoint = (line: string): boolean => {
    const trimmed = line.trim();
    // Blank lines are good break points
    if (trimmed === "") return true;
    // Lines ending with certain patterns (End If, End Loop, Exit Script, etc.)
    if (/^(End\s+(If|Loop|Script)|Exit\s+(Loop|Script)|Commit\s+Records)/i.test(trimmed)) {
      return true;
    }
    return false;
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue; // Skip undefined lines (shouldn't happen, but TypeScript safety)
    
    const lineSize = line.length;
    const wouldExceedLimit = currentSize + lineSize > maxChunkSize;
    
    if (wouldExceedLimit && currentChunk.length > 0) {
      // We're about to exceed the limit - try to find a good break point
      // Look backwards up to 10 lines for a blank line or step ending
      let breakIndex = -1;
      for (let j = currentChunk.length - 1; j >= Math.max(0, currentChunk.length - 10); j--) {
        if (isGoodBreakPoint(currentChunk[j] || "")) {
          breakIndex = j + 1; // Break after this line
          break;
        }
      }
      
      if (breakIndex > 0) {
        // Found a good break point - split there
        const chunkToAdd = currentChunk.slice(0, breakIndex);
        chunks.push(chunkToAdd.join("\n"));
        currentChunk = currentChunk.slice(breakIndex);
        // Recalculate size of remaining chunk
        currentSize = currentChunk.join("\n").length;
      } else {
        // No good break point found - force split at current position
        chunks.push(currentChunk.join("\n"));
        currentChunk = [];
        currentSize = 0;
      }
    }
    
    // Add the current line
    currentChunk.push(line);
    currentSize += lineSize + 1; // +1 for newline
  }
  
  // Add the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n"));
  }
  
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Clean problematic characters from XML text content that could cause AppleScript conversion to fail.
 * Only affects text content between tags, not tags themselves or attribute values.
 */
function cleanXMLTextContent(xml: string): string {
  let cleaned = xml;
  
  // Protect XML tags and attributes
  const tagPlaceholders: string[] = [];
  cleaned = cleaned.replace(/<[^>]+>/g, (match) => {
    const placeholder = `__TAG_${tagPlaceholders.length}__`;
    tagPlaceholders.push(match);
    return placeholder;
  });
  
  // Remove problematic Unicode characters from text content:
  // - Box-drawing characters (U+2500-U+259F)
  // - Control characters (except common whitespace: tab, LF, CR)
  cleaned = cleaned.replace(/[\u2500-\u257F\u2580-\u259F]/g, "");
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, "");
  
  // Restore tags
  tagPlaceholders.forEach((tag, index) => {
    cleaned = cleaned.replace(`__TAG_${index}__`, tag);
  });
  
  return cleaned;
}

/**
 * Sanitize XML by properly escaping special characters in text content
 * Fixes unescaped ampersands and other XML special characters
 */
function sanitizeXML(xml: string): string {
  // First clean problematic characters from text content
  let sanitized = cleanXMLTextContent(xml);
  
  // Fix unescaped ampersands in text content (but not in CDATA, tags, or already escaped)
  // First, protect CDATA sections
  const cdataSections: string[] = [];
  sanitized = sanitized.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (match) => {
    const placeholder = `__CDATA_${cdataSections.length}__`;
    cdataSections.push(match);
    return placeholder;
  });
  
  // Protect XML tags (attribute values and tag names)
  const tagPlaceholders: string[] = [];
  sanitized = sanitized.replace(/<[^>]+>/g, (match) => {
    const placeholder = `__TAG_${tagPlaceholders.length}__`;
    tagPlaceholders.push(match);
    return placeholder;
  });
  
  // Now fix special characters in text content (tags are protected as placeholders)
  // Replace & that's not part of a valid entity (not followed by #, letters/digits, semicolon)
  sanitized = sanitized.replace(/&(?!#?[a-zA-Z0-9]+;)/g, "&amp;");
  // Replace < and > in text content (tags are already protected)
  sanitized = sanitized.replace(/</g, "&lt;");
  sanitized = sanitized.replace(/>/g, "&gt;");
  
  // Restore tags (which still have their original < and >)
  tagPlaceholders.forEach((tag, index) => {
    sanitized = sanitized.replace(`__TAG_${index}__`, tag);
  });
  
  // Restore CDATA sections
  cdataSections.forEach((cdata, index) => {
    sanitized = sanitized.replace(`__CDATA_${index}__`, cdata);
  });
  
  return sanitized;
}

/**
 * Extract Step elements from FileMaker XML
 */
function extractStepsFromXML(xml: string): string {
  // Use regex to extract all <Step>...</Step> elements
  const stepMatches = xml.match(/<Step[^>]*>[\s\S]*?<\/Step>/g);
  if (!stepMatches || stepMatches.length === 0) {
    return "";
  }
  return stepMatches.join("\n  ");
}

/**
 * Combine multiple XML chunks into a single valid FileMaker XML document
 */
function combineXMLChunks(xmlChunks: string[]): string {
  const allSteps: string[] = [];
  
  for (const xml of xmlChunks) {
    const steps = extractStepsFromXML(xml);
    if (steps) {
      allSteps.push(steps);
    }
  }
  
  if (allSteps.length === 0) {
    throw new Error("No valid steps found in any XML chunks");
  }
  
  // Combine into a single XML document
  const combinedXML = `<?xml version="1.0" encoding="UTF-8"?>
<fmxmlsnippet type="FMObjectList">
  ${allSteps.join("\n  ")}
</fmxmlsnippet>`;
  
  // Sanitize the final combined XML to fix any escaping issues
  return sanitizeXML(combinedXML);
}

/**
 * Call ProofChat API to convert a single chunk of text to FileMaker XML
 */
async function convertChunkToXML(
  text: string,
  secret: string,
  licenseKey: string,
  activationData: string,
  openaiKey: string,
): Promise<string> {
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
 * Call ProofChat API to convert text to FileMaker XML
 * Uses chunking for large scripts to avoid size limitations
 * 
 * NOTE: We send the ORIGINAL text to ProofChat (no preprocessing) so the API can parse it correctly.
 * Preprocessing/sanitization only happens on the XML response to fix escaping issues.
 */
async function convertTextToXML(text: string): Promise<string> {
  // Send ORIGINAL text to ProofChat - don't preprocess before API call
  // The API needs the original script text to parse steps correctly
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

  // Estimate if chunking is needed (roughly 15KB of text might generate 50KB+ XML)
  const chunkThreshold = 15000; // Characters of text
  
  if (text.length > chunkThreshold) {
    // Split into chunks and process in parallel
    const chunks = splitScriptIntoChunks(text, chunkThreshold);
    
    if (chunks.length > 1) {
      // Process all chunks in parallel with ORIGINAL text
      const xmlPromises = chunks.map((chunk) =>
        convertChunkToXML(chunk, secret, licenseKey, activationData, openaiKey),
      );
      
      const xmlChunks = await Promise.all(xmlPromises);
      
      // Sanitize each XML chunk AFTER getting response (fixes XML escaping issues)
      const sanitizedChunks = xmlChunks.map((xml) => sanitizeXML(xml));
      
      // Combine all XML chunks into a single document
      return combineXMLChunks(sanitizedChunks);
    }
  }

  // For smaller scripts, process normally with ORIGINAL text
  const xml = await convertChunkToXML(text, secret, licenseKey, activationData, openaiKey);
  // Sanitize the XML AFTER getting response to fix any escaping issues
  return sanitizeXML(xml);
}

/**
 * Execute AppleScript to set clipboard with XML
 * Returns true if successful, false if failed (e.g., due to size)
 */
function setClipboardViaAppleScript(xml: string): boolean {
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
      // Clean up temp files
      try {
        unlinkSync(xmlFilePath);
        unlinkSync(scriptFilePath);
      } catch {}
      return false;
    }

    // Clean up temp files
    unlinkSync(xmlFilePath);
    unlinkSync(scriptFilePath);
    return true;
  } catch (error) {
    // Clean up on error
    try {
      unlinkSync(xmlFilePath);
      unlinkSync(scriptFilePath);
    } catch {}
    
    // Return false on error (size limit or other issues)
    return false;
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
      const { text, filePath } = args as { text?: string; filePath?: string };

      // Validate that at least one parameter is provided
      if (!text && !filePath) {
        throw new Error("Either 'text' or 'filePath' must be provided");
      }

      // Read script text from file if filePath is provided, otherwise use text
      let scriptText: string;
      if (filePath) {
        if (!existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        try {
          let rawText = readFileSync(filePath, "utf8");
          // Normalize line endings to LF (Unix-style) - strip CRLF and CR
          scriptText = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
          // Strip BOM if present
          if (scriptText.charCodeAt(0) === 0xfeff) {
            scriptText = scriptText.slice(1);
          }
        } catch (error) {
          throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        scriptText = text!; // Safe because we validated above
      }

      let xml: string | undefined;
      let debugXmlPath: string | undefined;

      try {
        // Step 1: Convert text to XML via API
        xml = await convertTextToXML(scriptText);

        // Always save XML to a file for inspection/backup
        debugXmlPath = join(tmpdir(), `fmodata-script-${Date.now()}.xml`);
        writeFileSync(debugXmlPath, xml, "utf8");

        // Step 2: Always try to set clipboard via AppleScript (no size limit)
        const clipboardSuccess = setClipboardViaAppleScript(xml);

        if (clipboardSuccess) {
          return {
            success: true,
            message:
              `FileMaker script has been converted to XML (${Math.round(xml.length / 1024)}KB) and placed on the clipboard. You can now paste it into FileMaker.`,
            xmlPath: debugXmlPath, // Path to XML file as backup
            xmlLength: xml.length,
          };
        } else {
          // Clipboard copy failed - return file path with instructions
          return {
            success: true,
            message:
              `FileMaker script has been converted to XML (${Math.round(xml.length / 1024)}KB). Clipboard copy failed, so the XML has been saved to a file. You can import this XML file directly into FileMaker using File > Import Records or by dragging it into Script Workspace.`,
            xmlPath: debugXmlPath,
            xmlLength: xml.length,
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        
        // Save XML even on error if we got it
        if (xml && !debugXmlPath) {
          try {
            debugXmlPath = join(tmpdir(), `fmodata-debug-error-${Date.now()}.xml`);
            writeFileSync(debugXmlPath, xml, "utf8");
          } catch {}
        }

        return {
          success: false,
          error: errorMessage,
          debugXmlPath, // Include path even on error
          xmlLength: xml?.length,
          xmlPreview: xml?.substring(0, 500),
        };
      }
    }
    default:
      throw new Error(`Unknown clipboard tool: ${name}`);
  }
}

