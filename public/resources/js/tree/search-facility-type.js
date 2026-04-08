/**
 * 설비 종류 트리 (search-facility-type.js)
 * /common/modalPopup.jsp에 연결
 */
function facilityMaster3(zNodes) {
    var setting = {
        view: {
            showIcon: false,
            nameIsHTML: true,
            selectedMulti: false
        },
        data: {
            key: {name: 'text'},
            simpleData: {
                enable: true,
                idKey: 'id',
                pIdKey: 'parent',
                rootPId: '#'
            }
        },
        callback: {
            onClick: function (event, treeId, node) {
                // facilityMaster3: 메인 트리 리프 클릭 시 상세조회
                if (treeId === 'facilityMaster3' && !node.isParent) {
                    $.ajax({
                        type: "POST",
                        url: "/common/facilitydetailList.do?searchUseYn=M3",
                        data: {eqType: node.id},
                        dataType: "html",
                        beforeSend: function () {
                            $("#loadingBar").css("display", "");
                        },
                        success: function (data) {
                            $("#facilityMasterList").html(data);
                        },
                        error: function (request, status, error) {
                            console.log("code:" + request.status + "\n message:" + request.responseText + "\n error:" + error);
                        },
                        complete: function () {
                            $("#loadingBar").css("display", "none");
                        }
                    });
                }

                // facilityType1: 팝업 트리 리프 클릭 시 값 셋팅 후 닫기
                if (treeId === 'facilityType1' && !node.isParent) {
                    var code = node.id;
                    var code_name = String(node.text).replace(/^\[[^\]]+\]/, '').trim();

                    $('#equipTypeOption').val(code);
                    $('#equipTypeInput').val(code_name);

                    var treeObj = $.fn.zTree.getZTreeObj('facilityType1');
                    if (treeObj) {
                        treeObj.cancelSelectedNode();
                        treeObj.expandAll(false);
                    }
                    $('#searchFacilityTypeTreePopup').find('.close').trigger('click');
                }
            }
        }
    };

    // zTree 초기화 (두 트리 별도 초기화)
    $.fn.zTree.init($("#facilityMaster3"), setting, zNodes);
    $.fn.zTree.init($("#facilityType1"), setting, zNodes);

    // 검색 기능: zTree 퍼지 검색
    var to = null;

    function debounce(fn, wait) {
        clearTimeout(to);
        to = setTimeout(fn, wait);
    }

    function filterZTree(treeSelector, query) {
        var treeObj = $.fn.zTree.getZTreeObj(treeSelector.replace('#', ''));
        if (!treeObj) return;

        var allNodes = treeObj.transformToArray(treeObj.getNodes());
        // 초기화: 모두 닫고 숨김
        treeObj.expandAll(false);
        allNodes.forEach(function (n) {
            n.highlight = false;
            treeObj.hideNode(n);
        });

        if (!query || query.length < 2) {
            allNodes.forEach(function (n) {
                treeObj.showNode(n);
            });
            return;
        }

        var matched = treeObj.getNodesByParamFuzzy('text', query, null)
            .concat(treeObj.getNodesByParamFuzzy('name', query, null));
        var seen = new Set();
        matched.forEach(function (n) {
            if (seen.has(n.tId)) return;
            seen.add(n.tId);
            treeObj.showNode(n);

            var p = n.getParentNode();
            while (p) {
                treeObj.showNode(p);
                treeObj.expandNode(p, true, false, false);
                p = p.getParentNode();
            }

            var children = treeObj.transformToArray([n]);
            children.forEach(function (c) {
                treeObj.showNode(c);
            });
        });
    }

    $('#search-input').off('keyup.fac3').on('keyup.fac3', function () {
        var q = $(this).val();
        debounce(function () {
            filterZTree('#facilityMaster3', q);
        }, 250);
    });
}

function fnInitTypeTree() {
    $.ajax({
        type: "POST",
        url: "/common/facilityTypeList.do",
        dataType: "json",
        success: function (data) {
            facilityMaster3(data);
        }
    });
}

$(document).ready(function () {
    fnInitTypeTree();
});
