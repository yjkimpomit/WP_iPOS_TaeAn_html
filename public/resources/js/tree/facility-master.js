/**
 * *******************************************************
 * 설비 마스터 트리 정보의 공통 메소드 *
 * *******************************************************
 */

'use strict';

function fnLoadFacilityTree(zNodes) {
    // zTree 설정
    var setting = {
        view: {
            showIcon: false,
            nameIsHTML: true,
            showTitle: false,
            expandSpeed: ""
        },
        async: {
            enable: true,
            url: "/facility/tree.do",
            type: "post",
            dataType: "json"
        },
        data: {
            key: {
                name: 'text'
            },
            simpleData: {
                enable: true,
                idKey: 'id',
                pIdKey: 'parent',
                rootPId: '#'
            }
        },
        callback: {
            onAsyncSuccess: function (event, treeId, treeNode, msg) {
                // 데이터 로딩 완료 후 로딩바 숨김
                $("#facLoadingBar").hide();

                // 데이터 갱신 후 노드 목록 업데이트
                if (typeof getNodeAll === 'function') {
                    getNodeAll();
                }

                // 대기 중인 검색어가 있으면 실행
                if (pendingSearchString) {
                    executeSearch(pendingSearchString);
                    pendingSearchString = null; // 실행 후 초기화
                }
            },
            onNodeCreated: function (event, treeId, node) {
            },
            onClick: function (event, treeId, treeNode, clickFlag) {
                try {
                    // 마지막 노드(leaf)/레벨 5(4)일 때만 우측 패널 컨텐츠 로드
                    if (treeNode && (treeNode.isParent === false || treeNode.level >= 4)) {
                        console.log("## fnLoadFacilityTree onclick ## " + treeNode['data-url']);
                        console.log("## fnLoadFacilityTree onclick ## " + JSON.stringify(treeNode));

                        var url = treeNode['data-url'];
                        var level = treeNode['data-level'];
                        var no = treeNode['data-no'];
                        console.log('## onclick ##', {url, level, no});
                        if (!url) return;

                        // 멀티뷰 팝업
                        fnOpenPopupStandard(url, "설비상세정보");
                    }
                } catch (e) {
                    console.error('Error fnLoadFacilityTree() :', e);
                }
            }
        }
    };

    // zTree 초기화
    var treeObj = $.fn.zTree.init($("#facTree"), setting, zNodes);

    // --- 평탄화 결과 캐시 ---
    var allNodes = null;

    // 검색 대기열
    var pendingSearchString = null;

    /** 트리 노드 열기/닫기 변수 */
    var facTreeExpandedAll = true;

    function getNodeAll() {
        allNodes = treeObj.transformToArray(treeObj.getNodes() || []);
    }

    getNodeAll();

    // 트리 새로고침: 성능 이슈로 zTree의 reAsyncChildNodes만 사용
    function safeRefreshTree() {
        treeObj.reAsyncChildNodes(null, "refresh", true);
    }

    // 검색 실행 로직 분리
    function executeSearch(searchString) {
        if (!searchString || searchString.length < 2) return;

        $('#facTree').find('.text-highlight').removeClass('text-highlight');
        var q = searchString.trim().toLowerCase();
        var nodes = treeObj.getNodesByFilter(function (node) {
            node._text = node['text'].trim().toLowerCase();
            node._no = (node['data-no'] != null ? String(node['data-no']) : '').toLowerCase();

            return q && (node._text.indexOf(q) !== -1) || (node._no.indexOf(q) !== -1);
        }, false);

        var searchCondition = $('#facSelect option:selected').val();

        // 설비(1) 또는 부품(2) 검색 공통 처리
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            openParentsTree(n);
            $("#" + n.tId + "_a").addClass('text-highlight');
            if (i === 0) {
                treeObj.selectNode(n);
            }
        }

        if (String(searchCondition) === '2') {
            $.ajax({
                type: "POST",
                url: "/facility/treePartSearch.do",
                data: {ietDecription: searchString},
                dataType: "json",
                success: function (data) {
                    var resultList = JSON.parse(data.result);
                    partSearchSelect(resultList);
                },
                error: function (request, status, error) {
                    console.error("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
                }
            });
        }
        facTreeExpandedAll = false;
    }

    // 검색 기능 구현 (설비명: zTree Fuzzy search, 부품: 서버 검색 결과 강조)
    $('#facSearchInput').off('keypress.zTreeSearch').on('keypress.zTreeSearch', function (e) {
        if (e.keyCode === 13) {
            var searchString = $(this).val();

            if (searchString.length >= 2) {
                $("#facLoadingBar").show();
                pendingSearchString = searchString; // 검색어 저장
                safeRefreshTree(); // 트리 새로고침 (비동기)
            }
        }
    });

    /**
     * 트리 노드 열기/닫기
     */
    $('#facSearchButton').on('click', function () {
        if (facTreeExpandedAll === false) {
            // 닫기(개선): 열린 부모만 깊은 레벨부터 닫기
            $("#facLoadingBar").show();

            safeRefreshTree();

            facTreeExpandedAll = true;
            $("#facSearchButton").html('<img src="/resources/images/icons/icon-expand_all.svg" alt="펼치기"/>');
        } else {
            // 전체 노드 기준: 부모노드(자식 보유 노드)만 재귀적으로 펼치기
            if (allNodes.length > 0) {
                $("#facLoadingBar").show();

                setTimeout(function () {
                    for (var i = 0; i < allNodes.length; i++) {
                        var n = allNodes[i];
                        // 레벨5 까지
                        if (n && n.isParent && n.level <= 3 && n.open !== true) {
                            treeObj.expandNode(n, true, false, false);
                        }
                    }

                    $("#facLoadingBar").hide();
                    facTreeExpandedAll = false;

                    $("#facSearchButton").html('<img src="/resources/images/icons/icon-collapse_all.svg" alt="접기"/>');
                }, 0);
            }
        }
    });

    // **부모 트리 펼치기**
    function openParentsTree(node) {
        if (!node) return;

        // 재귀적 부모노드 오픈
        var current = node;
        while (current) {
            var p = current.getParentNode ? current.getParentNode() : null;
            if (p) treeObj.expandNode(p, true, false, false);
            current = p;
        }

        // 자신 열기
        treeObj.expandNode(node, true, false, false);
    }

    // **부품 검색 관련 부모 노드 포커스/펼치기**
    function partSearchSelect(resultList) {
        for (var i = 0; i < resultList.length; i++) {
            var partParentNodeId = resultList[i].id;
            var partParentNode = treeObj.getNodeByParam('id', partParentNodeId, null);
            if (partParentNode) {
                openParentsTree(partParentNode);
                $("#" + partParentNode.tId + "_a").addClass('text-highlight');
            }
        }
    }
}

$(document).ready(function () {
    //<%-- load facility tree list --%>
    $.ajax({
        type: "POST",
        url: "/facility/tree.do",
        dataType: "json",
        beforeSend: function () {
            $("#facLoadingBar").show();
        },
        success: function (data) {
            var startInit = function () {
                fnLoadFacilityTree(data);
            };
            if (window.requestAnimationFrame) {
                requestAnimationFrame(function () {
                    setTimeout(startInit, 0);
                });
            } else {
                setTimeout(startInit, 0);
            }
        },
        complete: function () {
            $("#facLoadingBar").hide();
        }
    });

    //<%-- 설비정보 팝업의 아이콘 클릭시 3d 모델로 이동 --%>
    $('#facTree').on('click', '.icon-3d', function (e) {
        e.preventDefault();
        e.stopPropagation();

        var modelType = $(this).attr('data-3d-target');
        var iegNo = $(this).attr('data-3d-target-no');
        console.log("#### facility-master.js:icon-3d:target no ### " + modelType + " ##### " + iegNo);

        // <%-- goto 3d model : call parent main script --%>
        /* 열려져 있는 모든 창을 최소화 함 : only view model */
        window.parent.$(".winbox:not(.min) .wb-min").trigger('click');
        window.parent.modelLoadToUnity(modelType, iegNo);
    });

    //<%-- 설비정보 팝업의 아이콘 클릭시 파노라마로 이동 --%>
    $('#facTree').on('click', '.icon-panorama', function (e) {
        e.preventDefault();
        e.stopPropagation();

        var level = $(this).attr('data-level');
        var iegNo = $(this).attr('data-no');
        console.log("#### facility-master.js:icon-panorama ### " + level + " ##### " + iegNo);

        // <%-- goto 3d model : call parent main script --%>
        /* 열려져 있는 모든 창을 최소화 함 : only view model */
        window.parent.$(".winbox:not(.min) .wb-min").trigger('click');
        window.parent.openPanoInfoPopup(level, iegNo);
    });
});
