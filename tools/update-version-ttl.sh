#!/bin/bash

git log -1 --pretty=format:"
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> . 
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix v-s: <http://semantic-machines.com/veda/veda-schema/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix app: <http://semantic-machines.com/veda/app/> . 

<http://semantic-machines.com/veda/config>  
    rdf:type owl:Ontology ;  
    v-s:loadPriority 4.

v-s:vedaVersion 
    rdf:type rdfs:Resource; 
    rdfs:label \"Veda\";
    v-s:appBuildVersion \"%h\"; 
    v-s:appBuildDate \"%ad\"^^xsd:dateTime; 
.
" --date=short > ontology/veda-version.ttl