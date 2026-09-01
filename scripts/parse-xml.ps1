# parse-xml.ps1
# Parses 4 CDISC XML files and outputs cdisc-data.json

$ErrorActionPreference = 'Stop'

$sdtmIgPath   = 'C:\Users\ginge\OneDrive\Documents\Pinnacle 21 Community\configs\2508.1\SDTM-IG 3.4 (FDA).xml'
$adamIgPath   = 'C:\Users\ginge\OneDrive\Documents\Pinnacle 21 Community\configs\2508.1\ADaM-IG 1.3 (FDA).xml'
$sdtmTermPath = 'C:\Users\ginge\OneDrive\Documents\Pinnacle 21 Community\configs\data\CDISC\SDTM\2026-03-27\SDTM Terminology.odm.xml'
$adamTermPath = 'C:\Users\ginge\OneDrive\Documents\Pinnacle 21 Community\configs\data\CDISC\ADaM\2026-03-27\ADaM Terminology.odm.xml'
$outputPath   = 'C:\Users\ginge\Downloads\MDRMSTR\scripts\cdisc-data.json'

$defNs = 'http://www.cdisc.org/ns/def/v2.0'
$nciNs = 'http://ncicb.nci.nih.gov/xml/odm/EVS/CDISC'

function Make-NsMgr {
    param([System.Xml.XmlDocument]$doc)
    [System.Xml.XmlNamespaceManager]$nm = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
    [void]$nm.AddNamespace('odm',    'http://www.cdisc.org/ns/odm/v1.3')
    [void]$nm.AddNamespace('def',    'http://www.cdisc.org/ns/def/v2.0')
    [void]$nm.AddNamespace('nciodm', 'http://ncicb.nci.nih.gov/xml/odm/EVS/CDISC')
    [void]$nm.AddNamespace('xlink',  'http://www.w3.org/1999/xlink')
    Write-Output $nm
}

function Sel {
    param([System.Xml.XmlNode]$node, [string]$xpath, [System.Xml.XmlNamespaceManager]$nm)
    return $node.SelectNodes($xpath, $nm)
}

function Sel1 {
    param([System.Xml.XmlNode]$node, [string]$xpath, [System.Xml.XmlNamespaceManager]$nm)
    return $node.SelectSingleNode($xpath, $nm)
}

function GAttr {
    param($node, [string]$name, [string]$ns = '')
    if ($null -eq $node) { return $null }
    $v = if ($ns) { $node.GetAttribute($name, $ns) } else { $node.GetAttribute($name) }
    if ([string]::IsNullOrEmpty($v)) { return $null }
    return $v
}

# ============================================================
# Parse IG XML
# ============================================================
function Parse-IG {
    param([string]$path, [string]$defaultPurpose)

    Write-Host "Loading: $path"
    [System.Xml.XmlDocument]$doc = New-Object System.Xml.XmlDocument
    [void]$doc.Load($path)
    [System.Xml.XmlNamespaceManager]$nm = Make-NsMgr -doc $doc
    [System.Xml.XmlElement]$root = $doc.DocumentElement

    $igGroups = Sel -node $root -xpath './/odm:ItemGroupDef' -nm $nm
    Write-Host "  ItemGroupDef nodes found: $($igGroups.Count)"

    $datasets = [System.Collections.Generic.List[object]]::new()
    foreach ($ig in $igGroups) {
        $code      = GAttr $ig 'Name'
        $purpose   = GAttr $ig 'Purpose'
        $repeating = GAttr $ig 'Repeating'
        $structure = GAttr $ig 'Structure' $defNs
        $cls       = GAttr $ig 'Class'     $defNs

        $descNode  = Sel1 -node $ig -xpath 'def:Description/odm:TranslatedText' -nm $nm
        if (-not $descNode) { $descNode = Sel1 -node $ig -xpath 'odm:Description/odm:TranslatedText' -nm $nm }
        $name = if ($descNode) { $descNode.InnerText.Trim() } else { $code }

        $itemRefs = [System.Collections.Generic.List[object]]::new()
        foreach ($ir in (Sel -node $ig -xpath 'odm:ItemRef' -nm $nm)) {
            $itemRefs.Add([ordered]@{
                itemOID     = GAttr $ir 'ItemOID'
                orderNumber = GAttr $ir 'OrderNumber'
                mandatory   = GAttr $ir 'Mandatory'
                keySequence = GAttr $ir 'KeySequence'
            })
        }

        $datasets.Add([ordered]@{
            code      = $code
            name      = $name
            purpose   = if ($purpose) { $purpose } else { $defaultPurpose }
            structure = $structure
            cls       = $cls
            repeating = $repeating
            itemRefs  = $itemRefs.ToArray()
        })
    }
    return ,$datasets.ToArray()
}

# ============================================================
# Parse Terminology XML
# ============================================================
function Parse-Terminology {
    param([string]$path)

    Write-Host "Loading: $path"
    [System.Xml.XmlDocument]$doc = New-Object System.Xml.XmlDocument
    [void]$doc.Load($path)
    [System.Xml.XmlNamespaceManager]$nm = Make-NsMgr -doc $doc
    [System.Xml.XmlElement]$root = $doc.DocumentElement

    # version date
    $creationDT  = GAttr $root 'CreationDateTime'
    $versionDate = $null
    if ($creationDT) {
        try   { $versionDate = ([datetime]$creationDT).ToString('yyyy-MM-dd') }
        catch { $versionDate = $creationDT.Substring(0, [Math]::Min(10, $creationDT.Length)) }
    }
    Write-Host "  CreationDateTime: $creationDT  -> version_date: $versionDate"

    $clNodes = Sel -node $root -xpath './/odm:CodeList' -nm $nm
    Write-Host "  CodeList nodes found: $($clNodes.Count)"

    $codelists = [System.Collections.Generic.List[object]]::new()
    foreach ($cl in $clNodes) {
        $oid        = GAttr $cl 'OID'
        $clName     = GAttr $cl 'Name'
        $dataType   = GAttr $cl 'DataType'
        $extensible = $cl.GetAttribute('CodeListExtensible', $nciNs)
        if ([string]::IsNullOrEmpty($extensible)) { $extensible = $null }

        $terms = [System.Collections.Generic.List[object]]::new()

        # EnumeratedItem
        foreach ($ei in (Sel -node $cl -xpath 'odm:EnumeratedItem' -nm $nm)) {
            $codedValue = GAttr $ei 'CodedValue'
            $aliasNode  = Sel1 -node $ei -xpath "odm:Alias[@Context='nci:ExtCodeID']" -nm $nm
            $nciCode    = if ($aliasNode) { GAttr $aliasNode 'Name' } else { $null }

            $synList = [System.Collections.Generic.List[string]]::new()
            foreach ($s in (Sel -node $ei -xpath 'nciodm:CDISCSynonym' -nm $nm)) { [void]$synList.Add($s.InnerText.Trim()) }

            $defNode    = Sel1 -node $ei -xpath 'nciodm:CDISCDefinition' -nm $nm
            $definition = if ($defNode) { $defNode.InnerText.Trim() } else { $null }
            $ptNode     = Sel1 -node $ei -xpath 'nciodm:PreferredTerm' -nm $nm
            $pt         = if ($ptNode) { $ptNode.InnerText.Trim() } else { $null }

            $terms.Add([ordered]@{
                type          = 'enumerated'
                value         = $codedValue
                nci           = $nciCode
                synonyms      = $synList.ToArray()
                definition    = $definition
                preferredTerm = $pt
            })
        }

        # CodeListItem
        foreach ($ci in (Sel -node $cl -xpath 'odm:CodeListItem' -nm $nm)) {
            $codedValue = GAttr $ci 'CodedValue'
            $decNode    = Sel1 -node $ci -xpath 'odm:Decode/odm:TranslatedText' -nm $nm
            $decodeText = if ($decNode) { $decNode.InnerText.Trim() } else { $null }

            $aliasNode = Sel1 -node $ci -xpath "odm:Alias[@Context='nci:ExtCodeID']" -nm $nm
            $nciCode   = if ($aliasNode) { GAttr $aliasNode 'Name' } else { $null }

            $synList = [System.Collections.Generic.List[string]]::new()
            foreach ($s in (Sel -node $ci -xpath 'nciodm:CDISCSynonym' -nm $nm)) { [void]$synList.Add($s.InnerText.Trim()) }

            $defNode    = Sel1 -node $ci -xpath 'nciodm:CDISCDefinition' -nm $nm
            $definition = if ($defNode) { $defNode.InnerText.Trim() } else { $null }
            $ptNode     = Sel1 -node $ci -xpath 'nciodm:PreferredTerm' -nm $nm
            $pt         = if ($ptNode) { $ptNode.InnerText.Trim() } else { $null }

            $terms.Add([ordered]@{
                type          = 'item'
                value         = $codedValue
                decode        = $decodeText
                nci           = $nciCode
                synonyms      = $synList.ToArray()
                definition    = $definition
                preferredTerm = $pt
            })
        }

        $codelists.Add([ordered]@{
            oid        = $oid
            name       = $clName
            dataType   = $dataType
            extensible = $extensible
            terms      = $terms.ToArray()
        })
    }

    Write-Host "  Codelists parsed: $($codelists.Count)" -ForegroundColor Green
    return [ordered]@{ versionDate = $versionDate; codelists = $codelists.ToArray() }
}

# ============================================================
# Main
# ============================================================
Write-Host "`n=== Parsing SDTM-IG ===" -ForegroundColor Cyan
$sdtmDomains = Parse-IG -path $sdtmIgPath -defaultPurpose 'Tabulation'
Write-Host "  SDTM domains: $($sdtmDomains.Count)" -ForegroundColor Green

Write-Host "`n=== Parsing ADaM-IG ===" -ForegroundColor Cyan
$adamDatasets = Parse-IG -path $adamIgPath -defaultPurpose 'Analysis'
Write-Host "  ADaM datasets: $($adamDatasets.Count)" -ForegroundColor Green

Write-Host "`n=== Parsing SDTM Terminology ===" -ForegroundColor Cyan
$sdtmTerm = Parse-Terminology -path $sdtmTermPath

Write-Host "`n=== Parsing ADaM Terminology ===" -ForegroundColor Cyan
$adamTerm = Parse-Terminology -path $adamTermPath

# ============================================================
# Write JSON
# ============================================================
Write-Host "`n=== Writing JSON ===" -ForegroundColor Cyan

$output = [ordered]@{
    sdtm_version_date = $sdtmTerm.versionDate
    adam_version_date = $adamTerm.versionDate
    sdtm_domains      = $sdtmDomains
    adam_datasets     = $adamDatasets
    sdtm_codelists    = $sdtmTerm.codelists
    adam_codelists    = $adamTerm.codelists
}

$json = $output | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($outputPath, $json, [System.Text.Encoding]::UTF8)

$sz = (Get-Item $outputPath).Length
Write-Host "Written: $outputPath  ($([Math]::Round($sz/1MB,2)) MB)" -ForegroundColor Green

# ============================================================
# Summary
# ============================================================
Write-Host "`n========== SUMMARY ==========" -ForegroundColor Yellow
Write-Host "SDTM domains     : $($sdtmDomains.Count)"
Write-Host "ADaM datasets    : $($adamDatasets.Count)"
Write-Host "SDTM codelists   : $($sdtmTerm.codelists.Count)"
Write-Host "ADaM codelists   : $($adamTerm.codelists.Count)"
Write-Host "sdtm_version_date: $($sdtmTerm.versionDate)"
Write-Host "adam_version_date: $($adamTerm.versionDate)"

Write-Host "`n--- Sample SDTM Domains (first 5) ---" -ForegroundColor Yellow
$sdtmDomains | Select-Object -First 5 | ForEach-Object {
    Write-Host ("  {0,-8} | {1,-50} | cls={2} | struct={3}" -f $_.code, $_.name, $_.cls, $_.structure)
}

Write-Host "`n--- Sample SDTM Codelists (first 5) ---" -ForegroundColor Yellow
$sdtmTerm.codelists | Select-Object -First 5 | ForEach-Object {
    Write-Host ("  {0,-40} | {1,-35} | terms={2}" -f $_.oid, $_.name, $_.terms.Count)
}

Write-Host "`n--- Sample ADaM Codelists (first 5) ---" -ForegroundColor Yellow
$adamTerm.codelists | Select-Object -First 5 | ForEach-Object {
    Write-Host ("  {0,-40} | {1,-35} | terms={2}" -f $_.oid, $_.name, $_.terms.Count)
}
